import { MicVAD } from '@ricky0123/vad-web';
import socket from '../component/socket/socket.js';

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/deepgram-tts`;

// Convert Float32 PCM → Signed 16-bit PCM Uint8Array
function floatTo16BitPCM(input) {
  const output = new Uint8Array(input.length * 2);
  const view = new DataView(output.buffer);
  for (let i = 0, offset = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return output;
}


// WAV header
function createWavHeader(sampleRate, numSamples, numChannels = 1, bitsPerSample = 16) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  const bytes = numSamples * numChannels * (bitsPerSample / 8);
  const totalBytes = bytes + 44;

  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalBytes, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, bytes, true);

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

class SimpleVoiceRecorder {
  constructor() {
    this.vadInstance = null;
    this.isRecording = false;
    this.isListening = false;
    this.recordingStartTime = null;
    this.pendingRequest = false;
    this.suspendUntilResponse = false;
    this.onTranscriptReady = null;
    this.onNoSpeech = null;
    this.partialTranscriptBuffer = '';
    this.noSpeechTimeout = 3000;
    this.minRecordingDuration = 900;
    this.sampleRate = 16000;
    this.noSpeechTimer = null;

    // Chunk batching to reduce socket calls
    this.chunkBuffer = [];
    this.chunkBatchSize = 3; // Send every 3 chunks
    this.chunkCounter = 0;
    
    // Error handling
    this.socketConnected = true;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    
    // Heartbeat to keep connection alive during long recordings
    this.heartbeatInterval = null;
    this.lastChunkTime = Date.now();
    this.maxSilenceDuration = 30000; // 30 seconds max silence
    
    // Monitor socket connection
    this.setupSocketMonitoring();
  }

  startHeartbeat() {
    // Clear existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Send periodic heartbeat during recording
    this.heartbeatInterval = setInterval(() => {
      if (this.isRecording) {
        const timeSinceLastChunk = Date.now() - this.lastChunkTime;
        
        // If too long without chunks, something might be wrong
        if (timeSinceLastChunk > this.maxSilenceDuration) {
          console.warn('⚠️ No chunks for 30s, stopping recording');
          this.stopListening();
        }
      }
    }, 5000); // Check every 5 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  setupSocketMonitoring() {
    socket.on('connect', () => {
      console.log('✅ Socket connected');
      this.socketConnected = true;
      this.reconnectAttempts = 0;
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ Socket disconnected');
      this.socketConnected = false;
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.socketConnected = false;
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        if (this.isRecording) {
          this.stopListening();
          alert('Connection lost. Please refresh the page and try again.');
        }
      }
    });
  }

  async initialize() {
    console.log('VAD-based recorder initialized');
    return true;
  }

  async startListening() {
    if (!(await this.initialize())) return false;

    this.isListening = true;
    this.partialTranscriptBuffer = '';
    console.log('Listening for voice...');

    this.noSpeechTimer = setTimeout(() => {
      if (this.isListening && this.onNoSpeech) this.onNoSpeech();
    }, this.noSpeechTimeout);

    try {
      this.vadInstance = await MicVAD.new({
        speechProbThreshold: 0.6,
        micInputOptions: {
          sampleRate: this.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
        baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/',
        onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',

        onSpeechStart: () => {
          console.log('🎤 Voice detected — streaming started');
          
          // Check socket connection before starting
          if (!this.socketConnected) {
            console.error('❌ Cannot start - socket not connected');
            return;
          }
          
          socket.emit("start-sarvam-stt", {
            languageCode: 'en-IN',
            model: 'saarika:v2.5',
            sample_rate: '16000'
          });

          this.chunkBuffer = [];
          this.chunkCounter = 0;
          this.lastChunkTime = Date.now();
          clearTimeout(this.noSpeechTimer);
          this.isRecording = true;
          this.recordingStartTime = Date.now();
          
          // Start heartbeat monitoring
          this.startHeartbeat();
        },

        onSpeechEnd: async (audio) => {
          const duration = Date.now() - this.recordingStartTime;
          console.log(`🔇 Voice End — duration: ${duration}ms`);
          this.isRecording = false;
          
          // Stop heartbeat
          this.stopHeartbeat();

          // Validate minimum duration
          if (duration < this.minRecordingDuration) {
            console.warn('⚠️ Recording too short, ignoring');
            return;
          }

          // Send any remaining buffered chunks first
          if (this.chunkBuffer.length > 0) {
            console.log(`📤 Flushing ${this.chunkBuffer.length} remaining chunks`);
            this.chunkBuffer.forEach(bufferedChunk => {
              socket.emit("audio-chunk", bufferedChunk);
            });
            this.chunkBuffer = [];
            this.chunkCounter = 0;
          }

          // Send final audio chunk
          if (this.socketConnected) {
            const pcmChunk = floatTo16BitPCM(audio);
            
            // Retry logic for final chunk
            let sent = false;
            for (let attempt = 0; attempt < 3 && !sent; attempt++) {
              try {
                socket.emit("audio-chunk", pcmChunk);
                sent = true;
                console.log(`✅ Final chunk sent (attempt ${attempt + 1})`);
              } catch (error) {
                console.error(`❌ Failed to send final chunk (attempt ${attempt + 1}):`, error);
                if (attempt < 2) {
                  await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
                }
              }
            }

            if (!sent) {
              console.error('❌ Failed to send final chunk after 3 attempts');
            }

            // Send stop signal
            socket.emit("stop-sarvam-stt");
            console.log('📤 Sent stop signal to backend');
          } else {
            console.error('❌ Cannot send - socket disconnected');
          }
        },
      });

      // STREAM LIVE AUDIO CHUNKS — BATCHED FOR EFFICIENCY
      this.vadInstance.onAudioChunk = (chunk) => {
        if (this.isRecording && this.socketConnected) {
          const pcmChunk = floatTo16BitPCM(chunk);
          
          // Update last chunk time
          this.lastChunkTime = Date.now();
          
          // Add to batch buffer
          this.chunkBuffer.push(pcmChunk);
          this.chunkCounter++;
          
          // Send in batches to reduce socket overhead
          if (this.chunkCounter >= this.chunkBatchSize) {
            try {
              // Send all buffered chunks
              this.chunkBuffer.forEach(bufferedChunk => {
                socket.emit("audio-chunk", bufferedChunk);
              });
              
              console.log(`📤 Sent batch of ${this.chunkBuffer.length} chunks`);
              
              // Clear buffer
              this.chunkBuffer = [];
              this.chunkCounter = 0;
            } catch (error) {
              console.error('❌ Error sending chunk batch:', error);
              // Keep buffer for retry on next batch
            }
          }
        } else if (!this.socketConnected) {
          console.warn('⚠️ Socket disconnected, buffering chunks...');
          // Keep buffering, will try to send when reconnected
        }
      };

      await this.vadInstance.start();
      return true;

    } catch (error) {
      console.error('VAD init failed:', error);
      return false;
    }
  }

  async toText() {
    // STT moved to WebSocket live streaming — keep placeholder
    return "";
  }

  stopListening() {
    this.isListening = false;
    clearTimeout(this.noSpeechTimer);
    this.stopHeartbeat(); // Stop heartbeat monitoring
    
    if (this.vadInstance) {
      if (typeof this.vadInstance.pause === 'function') this.vadInstance.pause();
      if (this.vadInstance.stream) {
        this.vadInstance.stream.getTracks().forEach(track => track.stop());
      }
      if (this.vadInstance.audioContext?.close)
        this.vadInstance.audioContext.close().catch(() => {});
      this.vadInstance = null;
    }
    this.isRecording = false;
    this.partialTranscriptBuffer = '';
    this.chunkBuffer = []; // Clear chunk buffer
    this.chunkCounter = 0;
    console.log('Stopped listening');
  }

  cleanup() {
    this.stopListening();
    this.stopHeartbeat();
    console.log('Cleaned up');
  }
}

export { SimpleVoiceRecorder };







// import { MicVAD } from '@ricky0123/vad-web';
// import socket from '../component/socket/socket.js';

// const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/deepgram-tts`;

// // Convert Float32 PCM → Signed 16-bit PCM Uint8Array
// function floatTo16BitPCM(input) {
//   const output = new Uint8Array(input.length * 2);
//   const view = new DataView(output.buffer);
//   for (let i = 0, offset = 0; i < input.length; i++, offset += 2) {
//     const s = Math.max(-1, Math.min(1, input[i]));
//     view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
//   }
//   return output;
// }

// // WAV header
// function createWavHeader(sampleRate, numSamples, numChannels = 1, bitsPerSample = 16) {
//   const buffer = new ArrayBuffer(44);
//   const view = new DataView(buffer);

//   const bytes = numSamples * numChannels * (bitsPerSample / 8);
//   const totalBytes = bytes + 44;

//   writeString(view, 0, 'RIFF');
//   view.setUint32(4, totalBytes, true);
//   writeString(view, 8, 'WAVE');

//   writeString(view, 12, 'fmt ');
//   view.setUint32(16, 16, true);
//   view.setUint16(20, 1, true);
//   view.setUint16(22, numChannels, true);
//   view.setUint32(24, sampleRate, true);
//   view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
//   view.setUint16(32, numChannels * (bitsPerSample / 8), true);
//   view.setUint16(34, bitsPerSample, true);

//   writeString(view, 36, 'data');
//   view.setUint32(40, bytes, true);

//   return buffer;
// }

// function writeString(view, offset, string) {
//   for (let i = 0; i < string.length; i++) {
//     view.setUint8(offset + i, string.charCodeAt(i));
//   }
// }

// export class SimpleVoiceRecorder {
//   constructor() {
//     this.vadInstance = null;
//     this.isRecording = false;
//     this.isListening = false;
//     this.recordingStartTime = null;
//     this.pendingRequest = false;
//     this.suspendUntilResponse = false;
//     this.onTranscriptReady = null;
//     this.onNoSpeech = null;
//     this.partialTranscriptBuffer = '';
//     this.noSpeechTimeout = 3000;
//     this.minRecordingDuration = 900;
//     this.sampleRate = 16000;
//     this.noSpeechTimer = null;

//     // NEW for streaming
//     this.chunkBuffer = [];
//   }

//   async initialize() {
//     console.log('VAD-based recorder initialized');
//     return true;
//   }

//   async startListening() {
//     if (!(await this.initialize())) return false;

//     this.isListening = true;
//     this.partialTranscriptBuffer = '';
//     console.log('Listening for voice...');

//     this.noSpeechTimer = setTimeout(() => {
//       if (this.isListening && this.onNoSpeech) this.onNoSpeech();
//     }, this.noSpeechTimeout);

//     try {
//       this.vadInstance = await MicVAD.new({
//         speechProbThreshold: 0.6,
//         micInputOptions: {
//           sampleRate: this.sampleRate,
//           channelCount: 1,
//           echoCancellation: true,
//           noiseSuppression: true,
//         },
//         baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/',
//         onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',

//         onSpeechStart: () => {
//           console.log('🎤 Voice detected — streaming started');
//           socket.emit("start-sarvam-stt");

//           this.chunkBuffer = [];
//           clearTimeout(this.noSpeechTimer);
//           this.isRecording = true;
//           this.recordingStartTime = Date.now();
//         },

//         onSpeechEnd: async (audio) => {
//           console.log("🔇 Voice End — sending final chunk");
//           this.isRecording = false;

//           const pcmChunk = floatTo16BitPCM(audio);
//           socket.emit("audio-chunk", pcmChunk);

//           socket.emit("stop-sarvam-stt");
//         },
//       });

//       // STREAM LIVE AUDIO CHUNKS — VERY IMPORTANT
//       this.vadInstance.onAudioChunk = (chunk) => {
//         if (this.isRecording) {
//           const pcmChunk = floatTo16BitPCM(chunk);
//           socket.emit("audio-chunk", pcmChunk);
//         }
//       };

//       await this.vadInstance.start();
//       return true;

//     } catch (error) {
//       console.error('VAD init failed:', error);
//       return false;
//     }
//   }

//   async toText() {
//     // STT moved to WebSocket live streaming — keep placeholder
//     return "";
//   }

//   stopListening() {
//     this.isListening = false;
//     clearTimeout(this.noSpeechTimer);
//     if (this.vadInstance) {
//       if (typeof this.vadInstance.pause === 'function') this.vadInstance.pause();
//       if (this.vadInstance.stream) {
//         this.vadInstance.stream.getTracks().forEach(track => track.stop());
//       }
//       if (this.vadInstance.audioContext?.close)
//         this.vadInstance.audioContext.close().catch(() => {});
//       this.vadInstance = null;
//     }
//     this.isRecording = false;
//     this.partialTranscriptBuffer = '';
//     console.log('Stopped listening');
//   }

//   cleanup() {
//     this.stopListening();
//     console.log('Cleaned up');
//   }
// }

// // export { SimpleVoiceRecorder };

