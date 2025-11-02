import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Login from './component/Login';
import Interview from './component/Interview';
import ResumeUpload from './component/ResumeUpload';
import RegisterOwner from './component/owner/RegisterOwner';
import ProfileOwner from './component/owner/ProfileOwner';
import LoginOwner from './component/owner/LoginOwner';

const IDNotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">ID Not Found</h1>
      <p className="text-gray-600">Please use a valid interview session URL with an ID.</p>
      <p className="text-sm text-gray-500 mt-2">Format: /[ID]/login</p>
    </div>
  </div>
);

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<IDNotFound />} />
        <Route path="/:id/login" element={<Login />} />
        {/* <Route path="/:id/upload-resume" element={<ResumeUpload />} /> */}
        <Route path="/:id/interview" element={<Interview />} />

      <Route path="/r/o" element={<RegisterOwner />} />
        <Route path="/l/o" element={<LoginOwner />} />
        <Route path="/p/o/:id" element={<ProfileOwner />} />


        <Route path="*" element={<IDNotFound />} />



      </Routes>
    </Router>
  )
}

export default App;

