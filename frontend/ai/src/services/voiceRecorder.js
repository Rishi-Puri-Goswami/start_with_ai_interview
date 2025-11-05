import { MicVAD } from '@ricky0123/vad-web'; // Named export: MicVAD only

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/deepgram-tts`;

// Manual utility: Convert Float32Array (-1.0 to 1.0) to 16-bit PCM Uint8Array (signed little-endian)
function floatTo16BitPCM(input) {
  const output = new Uint8Array(input.length * 2); // 2 bytes per sample
  const view = new DataView(output.buffer);
  for (let i = 0, offset = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i])); // Clamp to [-1, 1]
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // Little-endian signed 16-bit
  }
  return output;
}

// Simple WAV header generator for 16kHz mono 16-bit PCM
function createWavHeader(sampleRate, numSamples, numChannels = 1, bitsPerSample = 16) {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  const bytes = numSamples * numChannels * (bitsPerSample / 8);
  const totalBytes = bytes + 44;

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalBytes, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
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
    this.isRecording = false; // Track speech segment
    this.isListening = false;
    this.recordingStartTime = null;
    this.pendingRequest = false;
    this.suspendUntilResponse = false;
    this.onTranscriptReady = null;
    this.onNoSpeech = null;
    this.partialTranscriptBuffer = '';
    // Tunable VAD params (replaces old thresholds)
    this.noSpeechTimeout = 3000;
    this.minRecordingDuration = 900; // ms
    this.sampleRate = 16000;
    this.noSpeechTimer = null;
  }

  async initialize() {
    // Library handles getUserMedia internally; just log
    console.log('VAD-based recorder initialized');
    return true;
  }

  async startListening() {
    if (!(await this.initialize())) return false;

    this.isListening = true;
    this.partialTranscriptBuffer = '';
    console.log('Listening for voice...');

    // No-speech prompt timer (library doesn't have built-in)
    this.noSpeechTimer = setTimeout(() => {
      if (this.isListening) {
        if (this.onNoSpeech) this.onNoSpeech();
        console.log('No voice detected—try speaking louder');
        // Restart for continuous listening
        clearTimeout(this.noSpeechTimer);
        this.noSpeechTimer = setTimeout(() => {
          if (this.isListening && this.onNoSpeech) this.onNoSpeech();
        }, this.noSpeechTimeout);
      }
    }, this.noSpeechTimeout);

    try {
      this.vadInstance = await MicVAD.new({
        // VAD options
        speechProbThreshold: 0.6, // Adjust 0-1 for sensitivity (lower = more sensitive)
        micInputOptions: {
          sampleRate: this.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
        // CDN paths: Loads WASM/model externally (fixes Vite bundling issues)
        baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/',
        onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
        onSpeechStart: () => {
          console.log('🎤 Voice detected—starting record');
          clearTimeout(this.noSpeechTimer); // Cancel no-speech
          this.isRecording = true;
          this.recordingStartTime = Date.now();
        },
        onSpeechEnd: async (audio) => { // audio: Float32Array @ 16kHz
          console.log('🔇 Silence detected—processing');
          this.isRecording = false;

          if (this.pendingRequest || this.suspendUntilResponse) {
            console.log('Silence detected but STT pending or suspended—ignoring');
            return;
          }

          // Estimate duration from audio length
          const durationMs = (audio.length / this.sampleRate) * 1000;
          if (durationMs < this.minRecordingDuration) {
            console.log('Recording too brief—continuing...');
            return;
          }

          // Convert Float32Array to 16-bit PCM WAV Blob
          const pcmData = floatTo16BitPCM(audio); // Use manual utility
          const wavHeader = createWavHeader(this.sampleRate, audio.length, 1);
          const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });

          let sttSucceeded = false;
          try {
            this.pendingRequest = true;
            this.suspendUntilResponse = true;
            const base64 = await this.blobToBase64(wavBlob);
            const transcript = await this.toText({ base64, format: 'wav' });
            const fullTranscript = (this.partialTranscriptBuffer + ' ' + (transcript || '')).trim();
            if (this.onTranscriptReady && fullTranscript) {
              this.onTranscriptReady(fullTranscript);
            }
            this.partialTranscriptBuffer = '';
            sttSucceeded = true;
          } catch (sttErr) {
            console.error('STT error while handling single-message flow:', sttErr);
          } finally {
            this.pendingRequest = false;
            if (!sttSucceeded) {
              this.suspendUntilResponse = false;
            }
          }
        },
        // Optional: onVADMisfire: () => { console.log('VAD misfire'); },
      });

      await this.vadInstance.start();
      return true;
    } catch (error) {
      console.error('VAD init failed:', error);
      return false;
    }
  }

  blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  async toText({ base64, format }) {
    let res;
    try {
      const interviewDetails = JSON.parse(localStorage.getItem('interviewdetails'));
      console.log("interviewdetails retrieved from localStorage", interviewDetails ? interviewDetails.launguage : "no details found");
      const language = interviewDetails ? interviewDetails.launguage : "en-IN";
      res = await fetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ audio: base64, format, language })
      });
    } catch (networkErr) {
      console.error('Network error calling STT:', networkErr);
      throw new Error('Network error calling STT: ' + (networkErr.message || networkErr));
    }
    // Try to parse JSON body even when status is not ok to surface server diagnostics
    let body;
    try {
      body = await res.json();
    } catch (parseErr) {
      const text = await res.text().catch(() => '<unreadable response>');
      console.error('STT response not JSON:', text);
      if (!res.ok) throw new Error(`STT failed: ${res.status} ${text}`);
      // If OK but not JSON, return text as transcript
      return (text || '').trim();
    }
    if (!res.ok) {
      console.error('STT server error:', body);
      // try to surface the server-provided message or error
      const msg = body?.error || body?.message || JSON.stringify(body);
      throw new Error('STT failed: ' + msg);
    }
    const transcript = body?.transcript || '';
    return (transcript || '').trim();
  }

  stopListening() {
    this.isListening = false;
    clearTimeout(this.noSpeechTimer);
    if (this.vadInstance) {
      // Correct API: Pause VAD processing (temporary stop)
      if (typeof this.vadInstance.pause === 'function') {
        this.vadInstance.pause();
      }
      // Full cleanup: Stop mic tracks and close AudioContext to free resources
      if (this.vadInstance.stream) {
        this.vadInstance.stream.getTracks().forEach(track => track.stop());
      }
      if (this.vadInstance.audioContext && this.vadInstance.audioContext.close) {
        this.vadInstance.audioContext.close().catch(err => console.warn('AudioContext close failed:', err));
      }
      this.vadInstance = null; // Prevent reuse
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



