import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socket, { setAuthToken } from './socket/socket';

// Helper to set cookie (not httpOnly) so socket middleware can read it during handshake
function setCookie(name, value, days) {
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=None; Secure';
}

const Login = () => {

const { id } = useParams(); 
const navigate = useNavigate();
const [errorMessage, setErrorMessage] = React.useState('');
const [isLoading, setIsLoading] = React.useState(false);

console.log("Login component, ID from URL:", id);

  const handleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      setErrorMessage(''); // Clear any previous errors
      
      // credentialResponse contains an encoded JWT credential (id_token)
      // Send it to the backend to verify/create user and get our token
      const idToken = credentialResponse.credential;

      // Validate and decode id_token with Google's tokeninfo endpoint
      const googleInfoRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      const googleData = googleInfoRes.data;

      // Prepare user info required by backend
      const payload = {
        email: googleData.email,
        name: googleData.name || googleData.given_name || '',
        photourl: googleData.picture || '',
        isverify: googleData.email_verified === 'true' || googleData.email_verified === true
      };
      // Use backend API endpoint and include credentials so httpOnly cookies are set
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/user/loginusergoogle/${id}`, payload, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      });

      const data = res.data;

      if (res.status === 200) {
        // Persist JWT in localStorage for socket handshake and API calls
        if (data.token) {
          try {
            localStorage.setItem('userToken', data.token);
            // Update socket auth token so socket connects as authenticated without reload
            try { setAuthToken(data.token); } catch (e) { console.warn('Failed to update socket auth token:', e); }
          } catch {}
        }
        if(res.data.finddetailsofintreview){
          localStorage.setItem('interviewdetails', JSON.stringify(res.data.finddetailsofintreview));
          console.log("interviewdetails stored in localStorage" , res.data.finddetailsofintreview.launguage);

        }

        // If backend returns user id, store in a non-httpOnly cookie as a convenience
        const userIdFromResponse = data.userId || data?.user?._id || data?.userId;
        if (userIdFromResponse) {
          setCookie('userId', userIdFromResponse, 1);
        }
        // Redirect to notice page with the same ID after successful login
        if(id){
          navigate(`/${id}/notice`);
        } else {
          console.error('No ID found in URL');
          setErrorMessage('Session ID not found. Please use a valid interview URL.');
        }

      }
    } catch (err) {
      console.error('Login error', err);
      
      // Handle different types of errors from backend
      if (err.response) {
        // The request was made and the server responded with a status code
        const status = err.response.status;
        const message = err.response.data?.message || 'An error occurred during login';
        
        console.error('Login failed', err.response.data);
        
        // Handle specific error codes
        switch (status) {
          case 403:
            setErrorMessage('❌ Access Denied: You are not authorized for this interview session.');
            break;
          case 404:
            setErrorMessage('❌ Interview session not found. Please check your invitation link.');
            break;
          case 406:
            setErrorMessage('❌ You have exceeded the maximum number of attempts for this interview.');
            break;
          case 400:
            setErrorMessage(`❌ ${message}`);
            break;
          case 500:
            setErrorMessage('❌ Server error occurred. Please try again later.');
            break;
          default:
            setErrorMessage(`❌ ${message}`);
        }
      } else if (err.request) {
        // The request was made but no response was received
        console.error('No response received from server');
        setErrorMessage('❌ Unable to connect to server. Please check your internet connection and try again.');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', err.message);
        setErrorMessage('❌ An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = () => {
    console.error('Google Login Failed');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center ">
      <div className=" p-2    w-fit  flex flex-col">
        {/* Logo */}
        <div>

        <div className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
             <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="43" fill="black"/>
    <path d="M50.1333 32V67.9333ZM37.0667 40.9833V58.95ZM24 45.475V54.4583ZM63.2 40.9833V58.95ZM76.2667 45.475V54.4583Z" fill="black"/>
    <path d="M50.1333 32V67.9333M37.0667 40.9833V58.95M24 45.475V54.4583M63.2 40.9833V58.95M76.2667 45.475V54.4583" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
          </div>
          <span className="text-black font-medium text-lg ">Startwith. Interview</span>
        </div>

        {/* Welcome Text */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-black mb-2">
            Welcome to Startwith.
          </h1>
          <p className="text-gray-600 text-base ">
            A new way to sort resume
          </p>
        </div>

        </div>
        
        {/* Error Message Display */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
          </div>
        )}
        
        {/* Google Login Button */}
        <div className="w-[20vw] items-center flex">
          {isLoading ? (
            <div className="w-full p-4 bg-gray-100 rounded-md flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-t-transparent border-gray-600 rounded-full animate-spin"></div>
              <span className="text-gray-600 font-medium">Signing in...</span>
            </div>
          ) : (
            <GoogleLogin 
              onSuccess={handleSuccess} 
              onError={handleError}
              width="100%"
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;