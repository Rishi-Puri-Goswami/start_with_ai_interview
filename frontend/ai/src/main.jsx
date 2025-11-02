import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
// 825866680823-jfr7dq4blqt6tie5tolnu3lsf6tqjj5m.apps.googleusercontent.com
const GOOGLE_CLIENT_ID = "550953009543-i3ari0upjpmj7qu9o4cmichdo6pdfirh.apps.googleusercontent.com"
createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <GoogleOAuthProvider clientId="550953009543-i3ari0upjpmj7qu9o4cmichdo6pdfirh.apps.googleusercontent.com" >
    <App />
  </GoogleOAuthProvider>
  // </StrictMode>,
)


