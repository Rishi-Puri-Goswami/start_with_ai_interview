// Frontend TTS service: calls backend Sarvam TTS `/speak` endpoint and falls back to browser TTS when unavailable.
// Backend base URL (server route mounted at /api/deepgram-tts)
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/deepgram-tts`;


/**
 * Creates an audio element from base64 data and plays it
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
        
        // Create audio element
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';

        if (autoPlay) {
            // Return a promise that resolves when playback ends
            return new Promise((resolve, reject) => {
                const cleanup = () => {
                    URL.revokeObjectURL(audioUrl);
                    audio.removeEventListener('ended', onEnded);
                    audio.removeEventListener('error', onError);
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

                audio.addEventListener('ended', onEnded);
                audio.addEventListener('error', onError);

                audio.play().catch(onError);
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
 * Text-to-Speech using Deepgram API via backend with browser fallback
 */



async function textToSpeech(inputText, options = {}) {
    try {
        console.log(' Starting TTS conversion via Sarvam backend...');

        // Validate input
        if (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0) {
            throw new Error('Invalid input: text must be a non-empty string');
        }

        const { autoPlay = true, target_language_code = "hi-IN", speaker = "abhilash", pitch = 0, pace = 1, loudness = 1, speech_sample_rate = 22050, enable_preprocessing = true, model = "bulbul:v2" } = options;

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
    getAvailableVoices,
    createAndPlayAudio,
    browserTextToSpeech,
    AVAILABLE_VOICES 
 };