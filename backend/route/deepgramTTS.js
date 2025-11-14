import express from "express";
import axios from 'axios';
import { SarvamAIClient } from 'sarvamai';
import fs from 'fs';
import path from 'path';
import os from 'os';
// const WebSocket = require('ws'); 
import WebSocket from "ws";
const router = express.Router();

// Use environment variable for API keys
const deepgramApiKey = process.env.DEEPGRAM_API_KEY || null;

// Note: ElevenLabs TTS SDK and related endpoints have been removed.
// The ELEVENLABS_API_KEY may still be used by other endpoints (e.g. STT) that call the ElevenLabs REST API directly.

// ============================================================================
// OPTIMIZATION: Simple LRU Cache for Common Phrases (Phase 1)
// ============================================================================
const TTS_CACHE_MAX_SIZE = 50; // Cache up to 50 common phrases
const ttsCache = new Map();

function getCachedAudio(text, options = {}) {
    // Create cache key from text + relevant options
    const cacheKey = `${text}|${options.target_language_code || 'hi-IN'}|${options.speaker || 'abhilash'}|${options.pace || 1.05}|${options.speech_sample_rate || 24000}`;
    
    if (ttsCache.has(cacheKey)) {
        const entry = ttsCache.get(cacheKey);
        // Move to end (LRU)
        ttsCache.delete(cacheKey);
        ttsCache.set(cacheKey, entry);
        console.log('💾 Cache HIT for:', text.substring(0, 50));
        return entry;
    }
    
    console.log('❌ Cache MISS for:', text.substring(0, 50));
    return null;
}

function setCachedAudio(text, options = {}, base64Audio) {
    const cacheKey = `${text}|${options.target_language_code || 'hi-IN'}|${options.speaker || 'abhilash'}|${options.pace || 1.05}|${options.speech_sample_rate || 24000}`;
    
    // If cache full, remove oldest entry (first in Map)
    if (ttsCache.size >= TTS_CACHE_MAX_SIZE) {
        const firstKey = ttsCache.keys().next().value;
        ttsCache.delete(firstKey);
    }
    
    ttsCache.set(cacheKey, base64Audio);
    console.log('💾 Cached audio for:', text.substring(0, 50), '(cache size:', ttsCache.size, ')');
}

// Common interview phrases to pre-cache on startup
const COMMON_PHRASES = [
    "Hello, welcome to the interview.",
    "Thank you for that answer.",
    "Can you tell me more about that?",
    "That's interesting.",
    "Let's move on to the next question.",
    "नमस्ते, साक्षात्कार में आपका स्वागत है।",
    "उस उत्तर के लिए धन्यवाद।",
    "क्या आप इसके बारे में और बता सकते हैं?",
    "यह दिलचस्प है।",
    "आइए अगले सवाल पर चलते हैं।"
];

// Pre-cache common phrases on startup (optional - can be disabled)
async function preCacheCommonPhrases() {
    console.log('🔄 Pre-caching common interview phrases...');
    const sarvamApiKey = process.env.SARVAM_API || null;
    if (!sarvamApiKey) {
        console.warn('⚠️ Cannot pre-cache: SARVAM_API_KEY not configured');
        return;
    }
    
    const sarvam = new SarvamAIClient({ apiSubscriptionKey: sarvamApiKey });
    let cachedCount = 0;
    
    for (const phrase of COMMON_PHRASES) {
        try {
            const opts = {
                text: phrase,
                target_language_code: 'hi-IN',
                speaker: 'abhilash',
                pace: 1.05,
                loudness: 1.2,
                speech_sample_rate: 24000,
                enable_preprocessing: true,
                model: 'bulbul:v2'
            };
            
            const ttsResponse = await sarvam.textToSpeech.convert(opts);
            let base64 = null;
            
            if (ttsResponse && ttsResponse.audio_url) {
                const audioRes = await axios.get(ttsResponse.audio_url, { responseType: 'arraybuffer' });
                base64 = Buffer.from(audioRes.data).toString('base64');
            } else if (ttsResponse && (ttsResponse.audio_base64 || ttsResponse.audio)) {
                base64 = ttsResponse.audio_base64 || ttsResponse.audio;
            }
            
            if (base64) {
                setCachedAudio(phrase, opts, base64);
                cachedCount++;
            }
        } catch (err) {
            console.warn('⚠️ Failed to pre-cache phrase:', phrase.substring(0, 30), err.message);
        }
    }
    
    console.log(`✅ Pre-cached ${cachedCount}/${COMMON_PHRASES.length} common phrases`);
}

// Start pre-caching (runs async, doesn't block server startup)
if (process.env.DISABLE_TTS_PRECACHE !== '1') {
    setTimeout(() => preCacheCommonPhrases(), 2000); // Wait 2s after server start
}
// ============================================================================

// Test endpoint to check Deepgram connection
router.get("/test", async (req, res) => {
  try {
    console.log('🧪 Testing Deepgram TTS connection...');
    
    const deepgram = createClient(deepgramApiKey);
    
    const testResponse = await deepgram.speak.request(
      { text: "Hello! This is a test of the text-to-speech system. If you can hear this message, the audio generation is working correctly." },
      { 
        model: 'aura-2-thalia-en'
      }
    );

    const stream = await testResponse.getStream();
    
    if (!stream) {
      throw new Error('No audio stream received');
    }

    // Just test if we can get the stream
    if (stream.destroy && typeof stream.destroy === 'function') {
      stream.destroy(); // Close the stream if it's a readable stream
    }
    // For other types (Buffer, Uint8Array), no cleanup needed
    
    console.log('✅ Deepgram TTS connection test successful');
    res.json({ 
      success: true, 
      message: 'Deepgram TTS connection test successful',
      apiKeyValid: true
    });

  } catch (error) {
    console.error('❌ Deepgram TTS test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      apiKeyValid: false,
      suggestion: 'Please check your Deepgram API key in the .env file'
    });
  }
});

// ElevenLabs TTS endpoint removed.
// If you want to add another TTS provider later, implement a new `/speak` endpoint here.

// Sarvam TTS endpoint - converts text to audio using SarvamAI and returns base64 audio
router.post("/speak", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text is required.' });
    }

    // Accept optional TTS options from client
    const opts = {
      target_language_code: req.body.target_language_code,
      speaker: req.body.speaker,
      pitch: req.body.pitch,
      pace: req.body.pace,
      loudness: req.body.loudness,
      speech_sample_rate: req.body.speech_sample_rate,
      enable_preprocessing: req.body.enable_preprocessing,
      model: req.body.model
    };

    // OPTIMIZATION: Check cache first
    const cachedAudio = getCachedAudio(text, opts);
    if (cachedAudio) {
      console.log('✅ Returning cached audio (instant response)');
      return res.json({ 
        success: true, 
        audioBase64: cachedAudio, 
        textLength: text.length, 
        method: 'sarvam-cached', 
        message: 'Speech generated from cache (instant)' 
      });
    }

    // Read Sarvam API key from environment to avoid embedding secrets in code
    const sarvamApiKey = process.env.SARVAM_API || null;
    if (!sarvamApiKey) {
      console.error('❌ SARVAM_API_KEY not configured in environment');
      return res.status(500).json({ success: false, error: 'Server missing SARVAM_API_KEY environment variable' });
    }

    // Initialize Sarvam client
    const sarvam = new SarvamAIClient({ apiSubscriptionKey: sarvamApiKey });

    // Add text to opts
    opts.text = text;

    console.log('🎯 Sarvam TTS request received (text length:', text.length, ')');

    const ttsResponse = await sarvam.textToSpeech.convert(opts);

    // Normalize response into base64 audio
    let base64 = null;

    if (ttsResponse && ttsResponse.audio_url) {
      // Download audio from provided URL
      try {
        const audioRes = await axios.get(ttsResponse.audio_url, { responseType: 'arraybuffer' });
        base64 = Buffer.from(audioRes.data).toString('base64');
      } catch (dlErr) {
        console.error('❌ Failed to download audio from Sarvam audio_url:', dlErr?.message || dlErr);
        return res.status(500).json({ success: false, error: 'Failed to download audio from Sarvam audio_url', details: dlErr?.message || String(dlErr) });
      }

    } else if (ttsResponse && (ttsResponse.audio_base64 || ttsResponse.audio)) {
      base64 = ttsResponse.audio_base64 || ttsResponse.audio;
    } else if (ttsResponse && Array.isArray(ttsResponse.audios) && ttsResponse.audios.length > 0) {
      const first = ttsResponse.audios[0];
      if (typeof first === 'string') base64 = first;
      else if (first && typeof first.base64 === 'string') base64 = first.base64;
    }

    if (!base64) {
      console.error('❌ Sarvam TTS returned no audio data; full response:', JSON.stringify(ttsResponse || {}, null, 2));
      return res.status(500).json({ success: false, error: 'Sarvam TTS returned no audio' });
    }

    // OPTIMIZATION: Cache the generated audio for future use
    setCachedAudio(text, opts, base64);

    console.log('✅ Sarvam TTS conversion successful, size (base64 chars):', base64.length);
    return res.json({ success: true, audioBase64: base64, textLength: text.length, method: 'sarvam', message: 'Speech generated successfully using Sarvam' });

  } catch (err) {
    console.error('❌ Sarvam TTS endpoint error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Sarvam TTS failed', details: err?.message || String(err) });
  }
});







// Handle preflight requests for transcribe endpoint (kept for CORS)
router.options("/transcribe", (req, res) => {
  const origin = req.headers.origin;
  if (['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173' , 'https://start-with-ai-interview.vercel.app' , 'https://interview.startwith.live'].includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.sendStatus(200);
});


router.post("/transcribe", async (req, res) => {
  try {
    // Add CORS headers - specific origin instead of wildcard for credentials
    const origin = req.headers.origin;
    if (['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173' , 'https://start-with-ai-interview.vercel.app' , 'https://interview.startwith.live'].includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    console.log('🎙️ Starting speech transcription (Sarvam)...');
    // Check if audio data is provided
    if (!req.body.audio) {
      return res.status(400).json({ success: false, error: 'Audio data is required' });
    }
    let { audio, format = 'webm', language , numSpeakers = 1 } = req.body;
    console.log('🔍 Audio format:', format);
    // If the client sent a data: URI (data:audio/webm;base64,AAA...), strip the prefix
    if (typeof audio === 'string' && audio.startsWith('data:')) {
      const idx = audio.indexOf(',');
      if (idx !== -1) audio = audio.slice(idx + 1);
    }
    // Convert base64 audio to buffer with validation
    let audioBuffer;
    try {
      if (typeof audio === 'string') {
        audioBuffer = Buffer.from(audio, 'base64');
      } else if (Buffer.isBuffer(audio)) {
        audioBuffer = audio;
      } else if (audio instanceof ArrayBuffer) {
        audioBuffer = Buffer.from(new Uint8Array(audio));
      } else {
        console.warn('⚠️ Unsupported audio payload type:', audio && audio.constructor && audio.constructor.name);
        return res.status(400).json({ success: false, error: 'Unsupported audio payload type' });
      }
    } catch (decodeErr) {
      console.error('❌ Failed to decode base64 audio:', decodeErr?.message || decodeErr);
      return res.status(400).json({ success: false, error: 'Invalid base64 audio data', details: decodeErr?.message || String(decodeErr) });
    }
    console.log('🎵 Processing audio buffer, size:', audioBuffer.length, 'bytes');
    if (!audioBuffer || audioBuffer.length < 100) {
      console.log('⚠️ Audio buffer too small or might be empty');
      return res.status(400).json({ success: false, error: 'Audio data too small or empty' });
    }
   // Prepare temporary paths (write file only as fallback)
   const tmpDir = path.join(os.tmpdir(), 'sarvam_stt');
   await fs.promises.mkdir(tmpDir, { recursive: true });
   const ext = format === 'webm' ? 'webm' : (format === 'wav' ? 'wav' : (format === 'mp3' ? 'mp3' : 'wav'));
   const tmpFile = path.join(tmpDir, `upload-${Date.now()}.${ext}`);
     // Initialize Sarvam client (read API key from environment)
     const sarvamApiKey = process.env.SARVAM_API || null;
     if (!sarvamApiKey) {
       console.error('❌ SARVAM_API_KEY not configured in environment');
       return res.status(500).json({ success: false, error: 'Server missing SARVAM_API_KEY environment variable' });
     }
     const client = new SarvamAIClient({ apiSubscriptionKey: sarvamApiKey });
  const languagecode  = language === "English" ? "en-IN" : "hi-IN";
     // Create a Sarvam STT job
     // Opt for faster defaults: disable timestamps and diarization unless explicitly requested.
     const preferFast = !!req.body.fast || process.env.SARVAM_STT_PREFER_FAST === '1';
     const jobOptions = {
       languageCode: languagecode ,
       model: preferFast ? (process.env.SARVAM_STT_FAST_MODEL || process.env.SARVAM_STT_MODEL || 'saarika:v2') : (process.env.SARVAM_STT_MODEL || 'saarika:v2.5'),
       withTimestamps: !!req.body.timestamps || false,
       withDiarization: !!req.body.diarization || false,
       numSpeakers: Number(numSpeakers) || 1
     };
     
     console.log('🛠️ Creating Sarvam STT job with options:', jobOptions);
     const job = await client.speechToTextJob.createJob(jobOptions);
     // Try to upload directly from buffer (avoid disk I/O). If SDK accepts an array of
     // in-memory file objects, prefer that. Fall back to temp-file upload if not supported.
     let usedTmpFile = false;
     try {
       // attempt in-memory upload; SDK implementations vary, try common shapes
       await job.uploadFiles([{ fileName: `audio.${ext}`, buffer: audioBuffer }]);
       console.log('📤 Uploaded audio buffer directly to Sarvam (in-memory)');
     } catch (memErr) {
       try {
         // Some SDK accept { name, data } shape
         await job.uploadFiles([{ name: `audio.${ext}`, data: audioBuffer }]);
         console.log('📤 Uploaded audio buffer directly (alternate shape)');
       } catch (memErr2) {
         // Fallback: write temp file and upload by path
         await fs.promises.writeFile(tmpFile, audioBuffer);
         usedTmpFile = true;
         await job.uploadFiles([tmpFile]);
         console.log('📤 Uploaded audio via temporary file:', tmpFile);
       }
     }
     // Start job and wait until complete
     await job.start();
     const finalStatus = await job.waitUntilComplete();
     if (await job.isFailed()) {
       console.error('❌ Sarvam STT job failed');
       return res.status(500).json({ success: false, error: 'Sarvam STT job failed' });
     }
   // Download outputs to a temporary output folder
   const outputDir = path.join(tmpDir, `output-${Date.now()}`);
   await fs.promises.mkdir(outputDir, { recursive: true });
   await job.downloadOutputs(outputDir);
     // Try to find a transcript file in the outputs
     const outFiles = await fs.promises.readdir(outputDir);
     let transcript = '';
     let rawJson = null;
     for (const f of outFiles) {
       const lower = f.toLowerCase();
       const p = path.join(outputDir, f);
       if (lower.endsWith('.txt')) {
         transcript = await fs.promises.readFile(p, 'utf8');
         break;
       }
       if (lower.endsWith('.json')) {
         try {
           const j = JSON.parse(await fs.promises.readFile(p, 'utf8'));
           rawJson = j;
           // Try common transcript fields
           transcript = j.text || j.transcript || j.results?.[0]?.text || j.data?.text || '';
           if (transcript) break;
         } catch (e) {
           // ignore parse error
         }
       }
     }
     // Fallback: if no transcript found but job has a result object, return that
     if (!transcript && rawJson) transcript = JSON.stringify(rawJson);
     console.log('✅ Sarvam STT completed; transcript length:', transcript ? transcript.length : 0);
     // Clean up temp files if created
     try {
       if (usedTmpFile && tmpFile) await fs.promises.unlink(tmpFile).catch(() => {});
       // optionally remove outputDir contents after reading
       // keep outputs for debugging if env DEBUG_SARVAM_OUTPUT=1
       if (process.env.DEBUG_SARVAM_OUTPUT !== '1') {
         const filesToRemove = await fs.promises.readdir(outputDir).catch(() => []);
         for (const f of filesToRemove) {
           await fs.promises.unlink(path.join(outputDir, f)).catch(() => {});
         }
         await fs.promises.rmdir(outputDir).catch(() => {});
       }
     } catch (_) {}
     return res.json({ success: true, transcript: transcript || '', audioLength: audioBuffer.length, files: outFiles, message: 'Speech transcribed successfully (Sarvam)' });
   } catch (error) {
     console.error('❌ Sarvam STT endpoint error:', error);
     res.status(500).json({ success: false, error: error.message || String(error) });
   }
});




router.get("/voices", (req, res) => {
  try {
    // Server-side voice listing not configured. Prefer browser voices or configure Sarvam voices.
    const availableVoices = [];
    res.json({
      success: true,
      voices: availableVoices,
      message: 'No server-side voices configured. Use browser TTS or configure Sarvam TTS voices on the server.'
    });
  } catch (error) {
    console.error('❌ Error getting voices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});




export default router;
