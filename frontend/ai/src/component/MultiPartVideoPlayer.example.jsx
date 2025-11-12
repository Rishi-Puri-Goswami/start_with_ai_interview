import React, { useState, useEffect } from 'react';
import MultiPartVideoPlayer from './component/MultiPartVideoPlayer';

/**
 * Example: How to use MultiPartVideoPlayer component
 * 
 * This example shows how to fetch interview results from the backend
 * and display the video using the MultiPartVideoPlayer component
 */

export default function InterviewResultsExample() {
  const [interviewData, setInterviewData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch interview results from your API
    const fetchInterviewResults = async () => {
      try {
        const response = await fetch('/api/interview-results/123'); // Replace with your API endpoint
        const data = await response.json();
        setInterviewData(data);
      } catch (error) {
        console.error('Failed to fetch interview results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInterviewResults();
  }, []);

  if (loading) {
    return <div>Loading interview...</div>;
  }

  if (!interviewData) {
    return <div>Interview not found</div>;
  }

  // The backend returns either:
  // 1. videoUrls: ['url1', 'url2', 'url3'] - for chunked uploads (NEW)
  // 2. videoUrl: 'single-url' - for old single uploads (LEGACY)
  
  const videoUrls = interviewData.videoUrls || (interviewData.videoUrl ? [interviewData.videoUrl] : []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Interview Recording</h1>
      
      {/* Display the video */}
      <div className="bg-black rounded-lg overflow-hidden mb-6">
        <MultiPartVideoPlayer 
          videoUrls={videoUrls}
          controls={true}
          autoPlay={false}
          className="w-full aspect-video"
        />
      </div>

      {/* Display interview metadata */}
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Feedback:</h2>
          <p>{interviewData.feedback?.overall_analysis}</p>
        </div>

        <div>
          <h2 className="font-semibold">Overall Score:</h2>
          <p>{interviewData.feedback?.overall_mark} / 100</p>
        </div>

        {videoUrls.length > 1 && (
          <div>
            <h2 className="font-semibold">Video Information:</h2>
            <p className="text-sm text-gray-600">
              This interview was recorded in {videoUrls.length} parts for optimal upload performance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Example: Display in a modal/popup
 */
export function VideoModalExample({ isOpen, onClose, interviewId }) {
  const [videoUrls, setVideoUrls] = useState([]);

  useEffect(() => {
    if (isOpen && interviewId) {
      // Fetch video URLs when modal opens
      fetch(`/api/interview/${interviewId}`)
        .then(res => res.json())
        .then(data => {
          const urls = data.videoUrls || (data.videoUrl ? [data.videoUrl] : []);
          setVideoUrls(urls);
        });
    }
  }, [isOpen, interviewId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Interview Video</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <MultiPartVideoPlayer 
          videoUrls={videoUrls}
          controls={true}
          className="w-full h-96"
        />
      </div>
    </div>
  );
}

/**
 * Example: Simple inline usage
 */
export function SimpleVideoExample() {
  // Example: Multiple video parts (chunked upload)
  const multiPartUrls = [
    'https://ik.imagekit.io/demo/interview-abc123-part1.webm',
    'https://ik.imagekit.io/demo/interview-abc123-part2.webm',
    'https://ik.imagekit.io/demo/interview-abc123-part3.webm'
  ];

  // Example: Single video (legacy or small interview)
  const singleUrl = [
    'https://ik.imagekit.io/demo/interview-xyz789.webm'
  ];

  return (
    <div className="space-y-8">
      {/* Multi-part video */}
      <div>
        <h3 className="font-semibold mb-2">Long Interview (3 parts)</h3>
        <MultiPartVideoPlayer 
          videoUrls={multiPartUrls}
          controls={true}
          className="w-full h-64 rounded-lg"
        />
      </div>

      {/* Single video */}
      <div>
        <h3 className="font-semibold mb-2">Short Interview (1 part)</h3>
        <MultiPartVideoPlayer 
          videoUrls={singleUrl}
          controls={true}
          className="w-full h-64 rounded-lg"
        />
      </div>
    </div>
  );
}
