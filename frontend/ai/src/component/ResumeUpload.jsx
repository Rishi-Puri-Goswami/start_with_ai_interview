import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const ResumeUpload = () => {
    const { id } = useParams(); // Get the ID from URL params
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const navigate = useNavigate();
    
    // Check if ID exists
    if (!id) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">ID Not Found</h1>
                    <p className="text-gray-600">Session ID is required to upload resume.</p>
                </div>
            </div>
        );
    }

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            setSelectedFile(file);
            setUploadStatus('');
        } else {
            setUploadStatus('Please select a PDF file.');
            setSelectedFile(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setUploadStatus('Please select a file first.');
            return;
        }

        setIsUploading(true);
        setUploadStatus('Uploading and processing your resume...');

        try {
            const formData = new FormData();
            formData.append('resume', selectedFile);

            const response = await axios.post('http://localhost:8001/api/user/extractstext', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                withCredentials: true
            });

            if (response.data.status === 200) {
                setUploadStatus('Resume uploaded successfully! Redirecting to interview...');
                
                // Use the same ID from URL params to maintain consistency
                setTimeout(() => {
                    navigate(`/${id}/interview`);
                }, 2000);
            } else {
                setUploadStatus('Upload failed. Please try again.');
            }
        } catch (error) {
            console.error('Upload error:', error);
            if (error.response?.data?.message) {
                setUploadStatus(`Error: ${error.response.data.message}`);
            } else {
                setUploadStatus('Upload failed. Please try again.');
            }
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div class="min-h-screen bg-gray-950 flex items-center justify-center p-6">
  <div class="max-w-xl w-full bg-gray-900 rounded-3xl shadow-2xl p-8 border border-gray-800 transition-all duration-300 transform hover:shadow-purple-500/10">

    <div class="text-center mb-8">
      <div class="inline-flex p-3 bg-purple-500/20 rounded-full mb-4">
        <svg class="h-10 w-10 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 class="text-4xl font-extrabold text-white mb-2 tracking-tight">Upload Your Resume</h2>
      <p class="text-gray-400 text-lg font-light">Your professional journey starts here. Let AI tailor your interview.</p>
    </div>

    <div class="space-y-6">
      <div>
        <label for="resume-upload" class="block text-sm font-semibold text-gray-300 mb-2">
          Select Resume <span class="text-gray-500">(PDF only)</span>
        </label>
        <div class="relative">
          <input
            id="resume-upload"
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            disabled={isUploading}
            class="block w-full text-sm text-gray-400
                  file:mr-4 file:py-3 file:px-6
                  file:rounded-full file:border-0
                  file:text-sm file:font-bold
                  file:bg-purple-600 file:text-white
                  hover:file:bg-purple-700
                  disabled:file:bg-gray-700 disabled:file:text-gray-500
                  cursor-pointer transition-colors duration-200"
          />
        </div>
      </div>

      {selectedFile && (
        <div class="p-4 bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-between">
          <p class="text-sm font-medium text-white truncate">
            <span class="text-purple-400">Selected:</span> {selectedFile.name}
          </p>
          <span class="text-xs text-gray-500 font-mono">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </span>
        </div>
      )}

      {uploadStatus && (
        <div class={`p-4 rounded-xl font-medium border
          ${uploadStatus.includes('Error') || uploadStatus.includes('failed')
            ? 'bg-red-900/40 text-red-300 border-red-800'
            : uploadStatus.includes('successfully')
              ? 'bg-green-900/40 text-green-300 border-green-800'
              : 'bg-blue-900/40 text-blue-300 border-blue-800'
          }`}>
          <p class="text-sm">{uploadStatus}</p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        class="w-full bg-purple-600 text-white py-3.5 px-4 rounded-full font-bold text-lg
              hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
              transition-all duration-300 transform hover:scale-[1.01] shadow-lg hover:shadow-purple-500/20
              flex items-center justify-center gap-3"
      >
        {isUploading ? (
          <>
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Processing...
          </>
        ) : (
          'Upload Resume'
        )}
      </button>

      <div class="text-xs text-gray-500 space-y-2 mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <p class="flex items-center gap-2"><svg class="h-4 w-4 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" fill-rule="evenodd"></path></svg> Only PDF files are supported.</p>
        <p class="flex items-center gap-2"><svg class="h-4 w-4 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" fill-rule="evenodd"></path></svg> Your resume will be analyzed by AI to create a personalized experience.</p>
        <p class="flex items-center gap-2"><svg class="h-4 w-4 text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" fill-rule="evenodd"></path></svg> Interview questions will be tailored specifically to your background.</p>
      </div>
    </div>
  </div>
</div>
    );
};

export default ResumeUpload;