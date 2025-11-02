
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const RegisterOwner = () => {
    const [form, setForm] = useState({
        name: 'Sahil',
        email: 'sahil@gmail.com',
        phone: '12345',
        password: '12345',
        secretKey: 'sahil',
    });
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        // Simple validation
        for (const key in form) {
            if (!form[key]) {
                setError('Please fill all fields.');
                return;
            }
        }
        // Simulate success
        setSuccess('Registration successful!');
        setForm({ name: '', email: '', phone: '', password: '', secretKey: '' });
        try {
            const response = await axios.post('http://localhost:8001/api/owner/register', form, { withCredentials: true });
            console.log(response.data);
            console.log(response.data.owner);

            navigate(`/p/o/${response.data.owner._id}`);
        } catch (error) {
            console.error(error);
            setError('Registration failed. Please try again.');
            setSuccess('');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#181A1B] from-gray-900 via-gray-800 to-gray-900">
            <div className="w-full max-w-5xl mx-4 rounded-xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 bg-gradient-to-tr from-gray-950/80 to-gray-900/80 border border-orange-600">
                {/* Left illustration */}
                <div className="hidden md:flex items-center justify-center bg-[#181A1B] p-8">
                    <div className="max-w-sm text-center">
                        <svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-2xl">
                            <defs>
                                {/* <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#ffe8d1" />
                                    <stop offset="100%" stopColor="#ffb07c" />
                                </linearGradient> */}
                            </defs>
                            <rect fill="url(#g1)" x="0" y="0" width="600" height="600" rx="24" />
                            <g transform="translate(50 120)">
                                <circle cx="120" cy="80" r="72" fill="#fff" opacity="0.14" />
                                <path d="M12 260 C90 170 240 170 318 260 L318 360 L12 360 Z" fill="#fff" opacity="0.08" />
                                <g transform="translate(260 -100)">
                                    <rect x="0" y="0" width="220" height="120" rx="18" fill="#fff" opacity="0.12" />
                                    <circle cx="40" cy="60" r="28" fill="#fff" opacity="0.18" />
                                    <rect x="90" y="30" width="110" height="14" rx="6" fill="#fff" opacity="0.18" />
                                    <rect x="90" y="60" width="80" height="10" rx="5" fill="#fff" opacity="0.12" />
                                </g>
                            </g>
                        </svg>
                        <h3 className="text-3xl font-semibold text-white mt-6">Welcome</h3>
                        <p className="text-orange-100 mt-2 opacity-90">Create your account to manage company profiles and interviews. Secure and fast.</p>
                    </div>
                </div>
                {/* Right form */}
                <div className="p-8 md:p-12 bg-gray-950/70">
                    <form onSubmit={handleSubmit} className="w-full">
                        <h2 className="text-3xl font-bold text-orange-400 mb-6 text-center tracking-wide">Owner Register</h2>
                        <div className="mb-4">
                            <label className="block text-orange-300 mb-1 font-medium" htmlFor="name">Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded bg-gray-800 text-orange-100 border border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                autoComplete="off"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-orange-300 mb-1 font-medium" htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded bg-gray-800 text-orange-100 border border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                autoComplete="off"
                                required
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-orange-300 mb-1 font-medium" htmlFor="phone">Phone</label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded bg-gray-800 text-orange-100 border border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                autoComplete="off"
                                required
                            />
                        </div>
                        <div className="mb-4 relative">
                            <label className="block text-orange-300 mb-1 font-medium" htmlFor="password">Password</label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded bg-gray-800 text-orange-100 border border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                                autoComplete="off"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-2 top-8 text-orange-400 hover:text-orange-200 focus:outline-none"
                                tabIndex={-1}
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <div className="mb-6 relative">
                            <label className="block text-orange-300 mb-1 font-medium" htmlFor="secretKey">Secret Key</label>
                            <input
                                type={showSecret ? 'text' : 'password'}
                                id="secretKey"
                                name="secretKey"
                                value={form.secretKey}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded bg-gray-800 text-orange-100 border border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                                autoComplete="off"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecret((v) => !v)}
                                className="absolute right-2 top-8 text-orange-400 hover:text-orange-200 focus:outline-none"
                                tabIndex={-1}
                                aria-label="Toggle secret key visibility"
                            >
                                {showSecret ? '🙈' : '👁️'}
                            </button>
                        </div>
                        {error && <div className="mb-4 text-red-400 text-center">{error}</div>}
                        {success && <div className="mb-4 text-green-400 text-center">{success}</div>}
                        <button
                            type="submit"
                            className="w-full py-2 rounded bg-orange-500 hover:bg-orange-600 text-white font-semibold text-lg shadow-md transition-colors duration-200"
                        >
                            Register
                        </button>
                        <div className="mt-6 text-center text-orange-200 text-sm opacity-80"
                            onClick={() => navigate("/l/owner")}>
                            Already have an account? <a className="text-orange-400 underline hover:text-orange-200">Login</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterOwner;



