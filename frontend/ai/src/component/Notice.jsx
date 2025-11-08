import React, { useState, useRef, useEffect } from 'react';
import { Smile, Wifi, Mic, Video, Check, X, Volume2, Info } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

export default function Notice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [micPermission, setMicPermission] = useState(null);
  const [videoPermission, setVideoPermission] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioBarLevels, setAudioBarLevels] = useState(new Array(20).fill(0));
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const micStreamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      micStreamRef.current = stream;
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const barCount = 20;
      
      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, (average / 128) * 100));
        
        // Create bar levels for visualization
        const newBarLevels = [];
        const step = Math.floor(dataArray.length / barCount);
        for (let i = 0; i < barCount; i++) {
          const start = i * step;
          const end = start + step;
          const sliceAvg = dataArray.slice(start, end).reduce((a, b) => a + b, 0) / step;
          newBarLevels.push(Math.min(100, (sliceAvg / 255) * 100));
        }
        setAudioBarLevels(newBarLevels);
        
        animationRef.current = requestAnimationFrame(checkLevel);
      };
      
      checkLevel();
    } catch (error) {
      setMicPermission('denied');
      console.error('Microphone permission denied:', error);
    }
  };

  const stopMic = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setMicPermission(null);
    setAudioLevel(0);
    setAudioBarLevels(new Array(20).fill(0));
  };

  const requestVideoPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setVideoPermission('granted');
      streamRef.current = stream;
      
      // Wait for next tick to ensure ref is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.log('Video autoplay handled by browser:', playError);
        }
      }
    } catch (error) {
      setVideoPermission('denied');
      console.error('Camera permission denied:', error);
    }
  };

  const stopVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
    setVideoPermission(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded">
              <svg viewBox="0 0 24 24" fill="white" className="w-full h-full p-1">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-gray-800">StartWith Interview</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-start justify-center min-h-[calc(100vh-73px)] p-8">
        <div className="w-full max-w-7xl grid lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Panel - Preview Section */}
          <div className="lg:col-span-1 space-y-6">
            {/* Camera Preview */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-gray-700" />
                  <h3 className="font-semibold text-gray-900">Camera Preview</h3>
                </div>
                {videoPermission === 'granted' && (
                  <Check className="w-5 h-5 text-green-600" />
                )}
                {videoPermission === 'denied' && (
                  <X className="w-5 h-5 text-red-600" />
                )}
              </div>
              
              {videoPermission === 'granted' ? (
                <div className="space-y-3">
                  <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={stopVideo}
                    className="w-full bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    Stop Camera
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                    <div className="text-center p-4">
                      <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No camera active</p>
                    </div>
                  </div>
                  <button
                    onClick={requestVideoPermission}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    Test Camera
                  </button>
                </div>
              )}
            </div>

            {/* Microphone Preview */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-gray-700" />
                  <h3 className="font-semibold text-gray-900">Microphone Preview</h3>
                </div>
                {micPermission === 'granted' && (
                  <Check className="w-5 h-5 text-green-600" />
                )}
                {micPermission === 'denied' && (
                  <X className="w-5 h-5 text-red-600" />
                )}
              </div>
              
              {micPermission === 'granted' ? (
                <div className="space-y-3">
                  {/* Audio Level Bar */}
                  <div className="flex items-center gap-2 px-2">
                    <Volume2 className="w-4 h-4 text-gray-500" />
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all duration-100"
                        style={{ width: `${audioLevel}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Audio Visualization Bars */}
                  <div className="bg-gradient-to-b from-gray-50 to-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-end justify-center gap-1.5 h-32">
                      {audioBarLevels.map((level, index) => (
                        <div
                          key={index}
                          className="w-2 bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400 rounded-full transition-all duration-100"
                          style={{
                            height: `${Math.max(8, level)}%`,
                            opacity: level > 5 ? 1 : 0.3
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-3">
                      {audioLevel > 10 ? '🎤 Listening...' : 'Speak to test your microphone'}
                    </p>
                  </div>
                  
                  <button
                    onClick={stopMic}
                    className="w-full bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    Stop Microphone
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-gray-100 rounded-lg p-8 flex items-center justify-center border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <Mic className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No microphone active</p>
                    </div>
                  </div>
                  <button
                    onClick={requestMicPermission}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    Test Microphone
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Instructions */}
          <div className="lg:col-span-2 bg-indigo-50 rounded-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 leading-tight">
              Before Starting the interview, remember<br />these things...
            </h2>
            
            <div className="space-y-6">
              {/* Find a Quiet Place */}
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 mt-1">
                  <Smile className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Find a Quiet Place</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Choose a spot with no background noise for the interview
                  </p>
                </div>
              </div>

              {/* Connect to stable Wi-Fi */}
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 mt-1">
                  <Wifi className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Connect to stable Wi-Fi</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Make sure you have a strong and stable internet connection
                  </p>
                </div>
              </div>

              {/* Check Your Mic, Camera and Speaker */}
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9a3 3 0 016 0v6a3 3 0 11-6 0V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9a3 3 0 016 0v6a3 3 0 11-6 0V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 01-6-6v-1.5m12 1.5v1.5a6 6 0 11-12 0v-1.5m6 6v3.75m-3.75 0h7.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Check Your Mic, Camera and Speaker</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Ensure your mic, camera and speaker are working properly
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Button at bottom of instructions */}
            <div className="mt-8 pt-6 border-t border-indigo-200">
              <button 
                onClick={() => {
                  if (micPermission === 'granted' && videoPermission === 'granted') {
                    navigate(`/${id}/interview`);
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-lg shadow-md transition-all disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
                disabled={micPermission !== 'granted' || videoPermission !== 'granted'}
              >
                Let's Get Started
              </button>
              {(micPermission !== 'granted' || videoPermission !== 'granted') && (
                <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Please test and grant both microphone and camera permissions from the left panel to continue
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}