// Frontend TTS service: calls backend Sarvam TTS `/speak` endpoint and falls back to browser TTS when unavailable.
// Backend base URL (server route mounted at /api/deepgram-tts)
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/deepgram-tts`;



// Global audio context and destination for mixing AI audio with video recording
let globalAudioContext = null;
let globalDestination = null;

/**
 * Smart sentence splitter - breaks text at natural boundaries
 * Optimized for Hindi/English mixed content
 */
function splitIntoSentences(text) {
    if (!text || !text.trim()) return [];
    
    // Regular expression for sentence boundaries
    // Handles: . ! ? । (Hindi full stop) followed by space or end
    const sentenceRegex = /([^.!?।]+[.!?।]+\s*)/g;
    const sentences = text.match(sentenceRegex) || [];
    
    // If no sentences found, split by length (max 150 chars per chunk)
    if (sentences.length === 0) {
        const chunks = [];
        const maxLength = 150;
        let remaining = text.trim();
        
        while (remaining.length > maxLength) {
            // Find last space before maxLength
            let splitIndex = remaining.lastIndexOf(' ', maxLength);
            if (splitIndex === -1) splitIndex = maxLength;
            
            chunks.push(remaining.substring(0, splitIndex).trim());
            remaining = remaining.substring(splitIndex).trim();
        }
        
        if (remaining) chunks.push(remaining);
        return chunks;
    }
    
    // Clean and filter sentences
    return sentences
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

/**
 * Get or create the global audio context and destination for mixing
 */
export function getAudioMixingContext() {
    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        globalDestination = globalAudioContext.createMediaStreamDestination();
    }
    return { audioContext: globalAudioContext, destination: globalDestination };
}

/**
 * Creates an audio element from base64 data and plays it
 * Also routes the audio through the mixing context so it can be recorded
 */
async function createAndPlayAudio(base64Data, autoPlay = true) {
    try {
        if (!base64Data) {
            throw new Error('No audio data provided');
        }

        console.log('🎵 Creating audio from base64 data...');
        console.log('📏 Data length:', base64Data.length);

        // Convert base64 to binary data
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
       
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
       
        // Create blob from binary data (Deepgram returns MP3)
        const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
       
        console.log('✅ Audio blob created:', audioBlob.size, 'bytes');
        
        // Create audio element with buffering
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous'; // Enable CORS for audio context

        // Route audio through the mixing context for recording
        const { audioContext, destination } = getAudioMixingContext();
        const source = audioContext.createMediaElementSource(audio);
        
        // Connect to both destination (for recording) and audioContext.destination (for playback)
        source.connect(destination);
        source.connect(audioContext.destination);

        if (autoPlay) {
            // Return a promise that resolves when playback ends
            return new Promise((resolve, reject) => {
                const cleanup = () => {
                    URL.revokeObjectURL(audioUrl);
                    audio.removeEventListener('ended', onEnded);
                    audio.removeEventListener('error', onError);
                    audio.removeEventListener('canplaythrough', onCanPlay);
                };

                const onEnded = () => {
                    cleanup();
                    console.log('✅ Audio playback completed');
                    resolve({
                        audio: audio,
                        url: audioUrl,
                        success: true
                    });
                };

                const onError = (e) => {
                    cleanup();
                    console.error('❌ Audio playback error:', e);
                    reject({
                        success: false,
                        error: e.message,
                        audio: null,
                        url: null
                    });
                };

                let canPlayFired = false;
                const onCanPlay = () => {
                    if (canPlayFired) return;
                    canPlayFired = true;
                    console.log('🎵 Audio buffered and ready to play');
                    // Audio is fully buffered, safe to play without stuttering
                    audio.play().catch(onError);
                };

                audio.addEventListener('ended', onEnded);
                audio.addEventListener('error', onError);
                audio.addEventListener('canplaythrough', onCanPlay);

                // Start loading the audio
                audio.load();
            });
        } else {
            // Non-autoPlay: return immediately
            return {
                audio: audio,
                url: audioUrl,
                success: true
            };
        }
       
    } catch (error) {
        console.error('❌ Error creating audio:', error);
        return {
            success: false,
            error: error.message,
            audio: null,
            url: null
        };
    }
}



/**
 * Fallback TTS using browser's Speech Synthesis API
 */
function browserTextToSpeech(text, options = {}) {
    return new Promise((resolve) => {
        try {
            if (!('speechSynthesis' in window)) {
                throw new Error('Speech synthesis not supported in this browser');
            }

            const { autoPlay = true, voiceName = 'default' } = options;
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure voice if available
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                // Try to find a specific voice or use default
                const voice = voices.find(v => v.name.toLowerCase().includes('female')) || voices[0];
                utterance.voice = voice;
            }
            
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            utterance.onend = () => {
                console.log(' Browser TTS playback completed');
                resolve({
                    success: true,
                    message: 'Text converted to speech using browser TTS',
                    method: 'browser',
                    textLength: text.length
                });
            };

            utterance.onerror = (event) => {
                console.error(' Browser TTS error:', event.error);
                resolve({
                    success: false,
                    error: `Browser TTS failed: ${event.error}`,
                    method: 'browser'
                });
            };

            if (autoPlay) {
                console.log(' Using browser TTS as fallback...');
                speechSynthesis.speak(utterance);
            }

            if (!autoPlay) {
                resolve({
                    success: true,
                    utterance: utterance,
                    message: 'Browser TTS utterance created (not played)',
                    method: 'browser'
                });
            }

        } catch (error) {
            console.error(' Browser TTS setup error:', error);
            resolve({
                success: false,
                error: error.message,
                method: 'browser'
            });
        }
    });
}



/**
 * OPTIMIZED: Sentence-level streaming TTS
 * Processes text sentence-by-sentence for lower perceived latency
 * Plays audio progressively while generating remaining sentences
 * NOW WITH: Audio preloading to eliminate gaps between sentences
 */
async function textToSpeechStreaming(inputText, options = {}) {
    try {
        console.log('🚀 Starting OPTIMIZED streaming TTS with preloading...');
        
        if (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0) {
            throw new Error('Invalid input: text must be a non-empty string');
        }

        // Split text into sentences
        const sentences = splitIntoSentences(inputText);
        console.log(`📝 Split into ${sentences.length} sentences for parallel processing`);
        
        if (sentences.length === 0) {
            throw new Error('No sentences to process');
        }

        // If only one sentence, use regular TTS
        if (sentences.length === 1) {
            return await textToSpeech(inputText, options);
        }

        // Process sentences with parallelization (2-3 at a time)
        const maxParallel = 3; // Increased from 2 to 3 for better preloading
        const audioQueue = [];
        let currentlyPlaying = null;
        let hasError = false;
        let nextAudioPreloaded = null; // For preloading optimization

        // Function to generate and preload audio for a sentence
        const generateAudio = async (sentence, index) => {
            try {
                console.log(`🎵 Generating audio for sentence ${index + 1}/${sentences.length}`);
                const result = await textToSpeech(sentence, { ...options, autoPlay: false });
                
                // OPTIMIZATION: Preload audio element
                if (result && result.audioElement) {
                    // Trigger preload by setting preload attribute
                    result.audioElement.preload = 'auto';
                    // Force load start
                    result.audioElement.load();
                }
                
                return { success: true, result, index, sentence };
            } catch (error) {
                console.error(`❌ Error generating sentence ${index + 1}:`, error);
                return { success: false, error, index, sentence };
            }
        };

        // Function to play audio sequentially with smart preloading
        const playNext = async () => {
            if (audioQueue.length === 0 || currentlyPlaying || hasError) return;
            
            // Get next audio in queue
            const nextAudio = audioQueue.shift();
            if (!nextAudio || !nextAudio.result || !nextAudio.result.audioElement) {
                return playNext();
            }

            currentlyPlaying = nextAudio;
            console.log(`▶️ Playing sentence ${nextAudio.index + 1}/${sentences.length}`);

            // OPTIMIZATION: Preload next audio while current plays
            if (audioQueue.length > 0 && audioQueue[0].result && audioQueue[0].result.audioElement) {
                const nextInQueue = audioQueue[0].result.audioElement;
                nextInQueue.preload = 'auto';
                nextInQueue.load();
                console.log(`⏩ Preloading next sentence ${audioQueue[0].index + 1} while playing ${nextAudio.index + 1}`);
            }

            try {
                const audio = nextAudio.result.audioElement;
                
                await new Promise((resolve, reject) => {
                    let canPlayFired = false;
                    
                    audio.onended = () => {
                        console.log(`✅ Finished sentence ${nextAudio.index + 1}`);
                        currentlyPlaying = null;
                        resolve();
                        // Small delay (50ms) between sentences for smoother transition
                        setTimeout(() => playNext(), 50);
                    };
                    
                    audio.onerror = (e) => {
                        console.error(`❌ Error playing sentence ${nextAudio.index + 1}:`, e);
                        currentlyPlaying = null;
                        reject(e);
                    };
                    
                    // Wait for audio to be fully buffered before playing
                    audio.addEventListener('canplaythrough', () => {
                        if (canPlayFired) return;
                        canPlayFired = true;
                        console.log(`🎵 Sentence ${nextAudio.index + 1} buffered, starting playback`);
                        audio.play().catch(reject);
                    }, { once: true });
                    
                    // Start loading
                    audio.load();
                });
            } catch (error) {
                console.error('Playback error:', error);
                currentlyPlaying = null;
                hasError = true;
            }
        };

        // Process sentences in batches with optimized parallelization
        for (let i = 0; i < sentences.length; i += maxParallel) {
            const batch = sentences.slice(i, i + maxParallel);
            const batchPromises = batch.map((sentence, idx) => 
                generateAudio(sentence, i + idx)
            );

            // Wait for batch to complete
            const results = await Promise.all(batchPromises);
            
            // Add successful results to queue in order
            for (const result of results) {
                if (result.success) {
                    audioQueue.push(result);
                    
                    // Start playing immediately if nothing is playing
                    if (!currentlyPlaying && audioQueue.length > 0) {
                        playNext();
                    }
                } else {
                    console.warn(`⚠️ Skipping failed sentence: ${result.sentence}`);
                }
            }
        }

        // Wait for all audio to finish playing
        while (audioQueue.length > 0 || currentlyPlaying) {
            await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms to 50ms for tighter monitoring
        }

        console.log('✅ All sentences played successfully with streaming + preloading');
        return {
            success: true,
            message: 'Streaming TTS completed with audio preloading',
            sentenceCount: sentences.length,
            method: 'streaming-optimized'
        };

    } catch (error) {
        console.error('❌ Streaming TTS Error:', error);
        
        // Fallback to regular TTS
        console.warn('Falling back to non-streaming TTS...');
        return await textToSpeech(inputText, options);
    }
}



/**
 * Text-to-Speech using Deepgram API via backend with browser fallback
 */



async function textToSpeech(inputText, options = {}) {
    try {
        console.log('🎤 Starting TTS conversion via Sarvam backend...');

        // Validate input
        if (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0) {
            throw new Error('Invalid input: text must be a non-empty string');
        }

        // OPTIMIZED: Balance between quality and speed
        const { 
            autoPlay = true, 
            target_language_code = "hi-IN", 
            speaker = "abhilash", 
            pitch = 0, 
            pace = 1.05,                       // ✅ 5% faster (reduced from 10% for better clarity)
            loudness = 1.2,                    // ✅ Increased volume for better clarity
            speech_sample_rate = 24000,        // ✅ Higher sample rate = better audio quality (was 16000)
            enable_preprocessing = true,       // ✅ Enable preprocessing for clearer audio
            model = "bulbul:v2"                // ✅ Use v2 (v1 no longer supported by Sarvam API)
        } = options;

        // Call backend Sarvam TTS API
        let response;
        try {
            response = await fetch(`${API_BASE_URL}/speak`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    text: inputText,
                    target_language_code,
                    speaker,
                    pitch,
                    pace,
                    loudness,
                    speech_sample_rate,
                    enable_preprocessing,
                    model
                })
            });
        } catch (netErr) {
            console.warn(' Sarvam backend unreachable, falling back to browser TTS:', netErr?.message || netErr);
            return await browserTextToSpeech(inputText, { autoPlay });
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.warn(' Sarvam backend returned error; falling back to browser TTS:', response.status, errorText);
            return await browserTextToSpeech(inputText, { autoPlay });
        }

        const data = await response.json().catch(() => null);
        if (!data || !data.success || !data.audioBase64) {
            console.warn(' Sarvam returned no audio, falling back to browser TTS', data);
            return await browserTextToSpeech(inputText, { autoPlay });
        }

        // Play the base64 audio returned by Sarvam
        const audioResult = await createAndPlayAudio(data.audioBase64, autoPlay).catch(async (e) => {
            console.error(' Error playing Sarvam audio, falling back to browser TTS:', e?.message || e);
            return await browserTextToSpeech(inputText, { autoPlay });
        });

        if (audioResult && audioResult.success) {
            return {
                success: true,
                audioUrl: audioResult.url,
                audioElement: audioResult.audio,
                message: data.message || 'Text converted to speech successfully using Sarvam',
                textLength: inputText.length,
                method: data.method || 'sarvam'
            };
        }

        // Fallback to browser TTS if audio playback failed
        return await browserTextToSpeech(inputText, { autoPlay });
    } catch (error) {
        console.error(' TTS Error:', error);
        console.warn('Falling back to browser TTS...');

        // Try browser TTS as fallback
        const fallbackResult = await browserTextToSpeech(inputText, options);

        if (fallbackResult.success) {
            return fallbackResult;
        }

        // If both fail, return error
        return {
            success: false,
            error: `Both Sarvam and browser TTS failed. Sarvam: ${error.message}, Browser: ${fallbackResult.error}`,
            errorType: error.name,
            audioElement: null,
            audioUrl: null,
            method: 'failed'
        };
    }
}



/**
 * Get available voices from Deepgram backend
 */





async function getAvailableVoices() {
    try {
        // Return available browser voices instead of backend ElevenLabs voices
        const voices = speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return [];
        return voices.map(v => ({ id: v.name, name: v.name, lang: v.lang }));
    } catch (error) {
        console.error(' Error fetching Deepgram voices:', error);
        // No fallback placeholder voices — the frontend should request real voice IDs from the backend
        return [];
    }
}

/**
 * Available Deepgram voice options
 */
// Remove hardcoded placeholder voice mapping — prefer dynamic voices from backend
const AVAILABLE_VOICES = {};

// Export functions

export { 
    textToSpeech,
    textToSpeechStreaming,
    getAvailableVoices,
    createAndPlayAudio,
    browserTextToSpeech,
    AVAILABLE_VOICES 
 };