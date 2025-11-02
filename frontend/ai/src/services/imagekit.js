// Import at top (after other imports)
import ImageKit from "imagekit-javascript-sdk"; // Or imagekitio-react for React hooks

// Add this function inside your component or as a utility
 export const uploadVideoToImageKit = async (videoBlob, sessionId) => {
  try {
    // Step 1: Fetch auth params from backend
    const authResponse = await fetch('/api/user/imagekit-auth', {
      method: 'GET',
      credentials: 'include', // If auth needed
    });
    if (!authResponse.ok) {
      throw new Error('Failed to get ImageKit auth params');
    }
    const { signature, expire, token, publicKey, urlEndpoint } = await authResponse.json();

    // Step 2: Initialize ImageKit
    const ik = new ImageKit({
      publicKey,
      urlEndpoint,
      authenticationEndpoint: '', // Not needed since we have direct params
    });

    // Step 3: Upload blob
    const uploadParams = {
      file: videoBlob, // Your Blob
      fileName: `interview-${sessionId}.webm`, // Or .mp4 if converted
      tags: ['interview', `session-${sessionId}`], // Optional
    };

    // Manually add auth to params (since we fetched them)
    uploadParams.signature = signature;
    uploadParams.expire = expire;
    uploadParams.token = token;

    console.log('📤 Uploading to ImageKit...');
    const response = await ik.upload(uploadParams);

    if (response.url) {
      console.log('✅ Upload success:', response.url);
      return response.url; // Full URL: https://ik.imagekit.io/qeg1tdi7s/path/to/video.webm
    } else {
      throw new Error('Upload failed: No URL returned');
    }
  } catch (error) {
    console.error('❌ ImageKit upload error:', error);
    throw error; // Re-throw for handling
  }
};