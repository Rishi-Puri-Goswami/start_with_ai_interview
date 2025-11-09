// src/hooks/useSarvamStream.js
export default class SarvamStreamer {
  constructor({ onPartial, onFinal }) {
    this.ws = null;
    this.processor = null;
    this.stream = null;
    this.onPartial = onPartial;
    this.onFinal = onFinal;
  }

  async start() {
    const res = await fetch('/api/sarvam-temp-key');
    const { tempKey } = await res.json();

    this.ws = new WebSocket('wss://api.sarvam.ai/v1/audio/transcriptions/stream');
    this.ws.onopen = () => {
      // Send key first (Sarvam expects the subscription key before config)
      if (tempKey) {
        try { this.ws.send(JSON.stringify({ 'api-subscription-key': tempKey })); } catch (e) { /* ignore */ }
      }
      // Then send config
      this.ws.send(JSON.stringify({
        model: 'saarika:v2',
        languageCode: 'hi-IN',
        response_format: 'json'
      }));
    };

    this.ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.is_final) this.onFinal(data.text);
      else this.onPartial(data.text);
    };

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext({ sampleRate: 16000 });
    const source = ctx.createMediaStreamSource(this.stream);
    this.processor = ctx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
      }
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(int16.buffer);
      }
    };

    source.connect(this.processor);
    this.processor.connect(ctx.destination);
  }

  stop() {
    this.ws?.close();
    this.processor?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());
  }
}

