import React, { useRef, useState, useEffect } from 'react';

/**
 * MultiPartVideoPlayer - Plays multiple video parts seamlessly as one continuous video
 * 
 * @param {Array<string>} videoUrls - Array of video part URLs to play in sequence
 * @param {string} className - Optional CSS classes for styling
 * @param {boolean} controls - Show video controls (default: true)
 * @param {boolean} autoPlay - Auto play video (default: false)
 */
export default function MultiPartVideoPlayer({ 
  videoUrls = [], 
  className = '', 
  controls = true, 
  autoPlay = false 
}) {
  const videoRef = useRef(null);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset to first part when videoUrls change
  useEffect(() => {
    setCurrentPartIndex(0);
    setError(null);
  }, [videoUrls]);

  // Handle video ended event - play next part
  const handleVideoEnded = () => {
    if (currentPartIndex < videoUrls.length - 1) {
      console.log(`✅ Part ${currentPartIndex + 1} finished, loading part ${currentPartIndex + 2}...`);
      setCurrentPartIndex(prev => prev + 1);
    } else {
      console.log('✅ All video parts completed');
    }
  };

  // Handle video load start
  const handleLoadStart = () => {
    setIsLoading(true);
    setError(null);
  };

  // Handle video can play
  const handleCanPlay = () => {
    setIsLoading(false);
  };

  // Handle video error
  const handleError = (e) => {
    console.error(`❌ Error loading video part ${currentPartIndex + 1}:`, e);
    setError(`Failed to load video part ${currentPartIndex + 1}`);
    setIsLoading(false);
  };

  // No videos provided
  if (!videoUrls || videoUrls.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 text-gray-400 ${className}`}>
        <p>No video available</p>
      </div>
    );
  }

  const currentVideoUrl = videoUrls[currentPartIndex];
  const totalParts = videoUrls.length;

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        key={currentVideoUrl} // Force re-render when URL changes
        src={currentVideoUrl}
        controls={controls}
        autoPlay={autoPlay || currentPartIndex > 0} // Auto-play subsequent parts
        onEnded={handleVideoEnded}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onError={handleError}
        className="w-full h-full"
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-sm">Loading part {currentPartIndex + 1} of {totalParts}...</div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-75">
          <div className="text-white text-sm text-center p-4">
            <p className="font-semibold">{error}</p>
            <p className="text-xs mt-2">Part {currentPartIndex + 1} of {totalParts}</p>
          </div>
        </div>
      )}

      {/* Part indicator (show only if multiple parts) */}
      {totalParts > 1 && !error && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
          Part {currentPartIndex + 1} / {totalParts}
        </div>
      )}
    </div>
  );
}
