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

    // NEW for streaming
    this.chunkBuffer = [];
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
          socket.emit("start-sarvam-stt");

          this.chunkBuffer = [];
          clearTimeout(this.noSpeechTimer);
          this.isRecording = true;
          this.recordingStartTime = Date.now();
        },

        onSpeechEnd: async (audio) => {
          console.log("🔇 Voice End — sending final chunk");
          this.isRecording = false;

          const pcmChunk = floatTo16BitPCM(audio);
          socket.emit("audio-chunk", pcmChunk);

          socket.emit("stop-sarvam-stt");
        },
      });

      // STREAM LIVE AUDIO CHUNKS — VERY IMPORTANT
      this.vadInstance.onAudioChunk = (chunk) => {
        if (this.isRecording) {
          const pcmChunk = floatTo16BitPCM(chunk);
          socket.emit("audio-chunk", pcmChunk);
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
    console.log('Stopped listening');
  }

  cleanup() {
    this.stopListening();
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

