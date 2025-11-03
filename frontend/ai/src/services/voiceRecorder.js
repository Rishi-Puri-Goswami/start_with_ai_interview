const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/deepgram-tts`;

class SimpleVoiceRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isListening = false;
        this.stream = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
    this.silenceThreshold = 0.08; // Voice detection sensitivity (lower = more sensitive)
    // Add frame counters to provide hysteresis and avoid flapping in noisy environments
    this.silenceFrames = 0;
    this.voiceFrames = 0;
    this.requiredSilenceFrames = 7; // consecutive silent frames needed to consider silence
    this.requiredVoiceFrames = 3; // consecutive active frames needed to consider voice
    // Reduced timeouts to lower end-to-end latency when user stops speaking
    this.silenceTimeout = 600; // ms of silence to stop recording (was 1500)
    this.noSpeechTimeout = 3000; // ms before prompting if no voice (was 5000)
    this.minRecordingDuration = 900; // Minimum ms of recording before considering a stop valid (was 1500)
        this.silenceTimer = null;
        this.noSpeechTimer = null;
        this.recordingStartTime = null;
    this.pendingRequest = false; // true while an STT request is in-flight
    this.suspendUntilResponse = false; // when true, do not start new recordings until cleared
        this.onTranscriptReady = null; // Callback: (transcript) => {}
        this.onNoSpeech = null; // Callback: () => {}
        this.partialTranscriptBuffer = ''; // Buffer for potential partial transcripts
    }


    async initialize() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000, channelCount: 1 }
            });
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            // Smaller fftSize -> quicker updates; reduce smoothing for faster reaction
            this.analyser.fftSize = 128;
            this.analyser.smoothingTimeConstant = 0.3;
            this.microphone.connect(this.analyser);
            
            console.log(' Simple recorder initialized');
            return true;
        } catch (error) {
            console.error(' Init failed:', error);
            return false;
        }
    }

    getAudioLevel() {
        if (!this.analyser) return 0;
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data.reduce((a, b) => a + b) / (data.length * 255);
    }

    isVoiceActive() {
        return this.getAudioLevel() > this.silenceThreshold;
    }

    async startListening() {
        if (!(await this.initialize())) return false;
        
        this.isListening = true;
        this.partialTranscriptBuffer = ''; // Reset buffer
        console.log(' Listening for voice...');
        
        // If no speech is detected within the timeout, notify the UI but remain listening.
        // We restart the noSpeechTimer so the recorder keeps attempting to listen without
        // requiring a page reload. The monitor loop will still detect voice and start recording.
        this.noSpeechTimer = setTimeout(() => {
            if (this.isListening) {
                if (this.onNoSpeech) this.onNoSpeech();
                console.log(' No voice detected—try speaking louder');
                // Restart the no-speech timer to continue listening and re-prompt if needed
                try {
                    clearTimeout(this.noSpeechTimer);
                    this.noSpeechTimer = setTimeout(() => {
                        if (this.isListening && this.onNoSpeech) this.onNoSpeech();
                    }, this.noSpeechTimeout);
                } catch (err) {
                    console.warn('Failed to restart noSpeechTimer:', err);
                }
            }
        }, this.noSpeechTimeout);
        
        this.monitorVoice();
        return true;
    }

    monitorVoice() {
        if (!this.isListening) return;
        
        const active = this.isVoiceActive();

        // Update hysteresis counters
        if (active) {
            this.voiceFrames += 1;
            this.silenceFrames = 0;
        } else {
            this.silenceFrames += 1;
            this.voiceFrames = 0;
        }

        // If we've seen enough consecutive voice frames, start recording
        if (this.voiceFrames >= this.requiredVoiceFrames && !this.isRecording) {
            console.log('🎤 Voice detected—starting record');
            clearTimeout(this.noSpeechTimer);
            this.startRecording();
        }

        // If we've seen enough consecutive silent frames while recording, consider stopping
        if (this.silenceFrames >= this.requiredSilenceFrames && this.isRecording) {
            if (!this.silenceTimer) {
                console.log(' Silence—checking if it persists...');
                this.silenceTimer = setTimeout(async () => {
                    this.silenceTimer = null;
                    // If a previous STT request is pending or we are suspended, ignore
                    if (this.pendingRequest || this.suspendUntilResponse) {
                        console.log(' Silence detected but STT request already pending or suspended — ignoring');
                        return;
                    }

                    // Confirm min recording duration and still silent
                    if (Date.now() - this.recordingStartTime >= this.minRecordingDuration && !this.isVoiceActive()) {
                        console.log(' Silence confirmed and min duration met—stopping and sending one message');
                        let sttSucceeded = false;
                        try {
                            this.pendingRequest = true;
                            this.suspendUntilResponse = true;

                            const audioResult = await this.stopRecording();
                            if (audioResult) {
                                try {
                                    const transcript = await this.toText(audioResult);
                                    const fullTranscript = (this.partialTranscriptBuffer + ' ' + (transcript || '')).trim();
                                    if (this.onTranscriptReady && fullTranscript) {
                                        this.onTranscriptReady(fullTranscript);
                                    }
                                    this.partialTranscriptBuffer = '';
                                    sttSucceeded = true;
                                } catch (sttErr) {
                                    console.error('STT error while handling single-message flow:', sttErr);
                                }
                            }
                        } finally {
                            this.pendingRequest = false;
                            if (!sttSucceeded) {
                                this.suspendUntilResponse = false;
                            }
                        }
                    } else {
                        console.log(' Silence too short or recording too brief—continuing...');
                    }
                }, this.silenceTimeout);
            }
        } else if (this.voiceFrames >= this.requiredVoiceFrames && this.isRecording && this.silenceTimer) {
            // Voice resumed—clear timer and continue
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        requestAnimationFrame(() => this.monitorVoice());
    }

    async startRecording() {
        this.audioChunks = [];
        this.recordingStartTime = Date.now();
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm;codecs=opus' });
        
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.audioChunks.push(e.data);
        };
        // Use a smaller timeslice so blobs are produced more frequently (helps faster stop and restart)
        this.mediaRecorder.start(50);
        this.isRecording = true;
        console.log(' Recording...');
    }

    async stopRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || !this.isRecording) {
                resolve(null);
                return;
            }
            
            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const base64 = await this.blobToBase64(blob);
                this.isRecording = false;
                this.audioChunks = [];
                resolve({ base64, format: 'webm' });
            };
            
            this.mediaRecorder.stop();
        });
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

             
  const interviewDetails = JSON.parse(localStorage.getItem('interviewdetails'))
  console.log("interviewdetails retrieved from localStorage" , interviewDetails ? interviewDetails.launguage : "no details found");

  const language = interviewDetails ? interviewDetails.launguage : "en-IN";


            res = await fetch(`${API_BASE_URL}/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ audio: base64, format , language })
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
        clearTimeout(this.silenceTimer);
        clearTimeout(this.noSpeechTimer);
        if (this.isRecording) this.stopRecording();
        this.partialTranscriptBuffer = ''; // Clear buffer on manual stop
        console.log(' Stopped listening');
    }

    cleanup() {
        this.stopListening();
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.audioContext) this.audioContext.close();
        console.log(' Cleaned up');
    }
}

export { SimpleVoiceRecorder };