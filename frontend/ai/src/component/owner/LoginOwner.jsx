import axios from 'axios'
import React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const LoginOwner = () => {
    const navigate = useNavigate()
    const [form, setForm] = useState({ email: 'sahil@gmail.com', password: '12345', secretkey: 'sahil' })

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        // console.log('Login details:', form)
        try {
            const response = await axios.post('http://localhost:8001/api/owner/login', form, { withCredentials: true })
            console.log("owner login response", response)
            console.log(response.data);
            navigate(`/p/o/${response.data.owner._id}`)
        } catch (error) {
            console.log("login owner error", error)
        }
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: '#f5f6fa'
        }}>
            <form
                onSubmit={handleSubmit}
                style={{
                    background: '#fff',
                    padding: '2rem',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    minWidth: '300px'
                }}
            >
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#2d3436' }}>Owner Login</h2>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '.5rem', color: '#636e72' }}>Email</label>
                    <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        style={{
                            width: '100%',
                            padding: '.5rem',
                            borderRadius: '4px',
                            border: '1px solid #dfe6e9'
                        }}
                    />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '.5rem', color: '#636e72' }}>Password</label>
                    <input
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        required
                        style={{
                            width: '100%',
                            padding: '.5rem',
                            borderRadius: '4px',
                            border: '1px solid #dfe6e9'
                        }}
                    />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '.5rem', color: '#636e72' }}>Secret Key</label>
                    <input
                        type="password"
                        name="secretkey"
                        value={form.secretkey}
                        onChange={handleChange}
                        required
                        style={{
                            width: '100%',
                            padding: '.5rem',
                            borderRadius: '4px',
                            border: '1px solid #dfe6e9'
                        }}
                    />
                </div>
                <button
                    type="submit"
                    style={{
                        width: '100%',
                        padding: '.75rem',
                        background: '#0984e3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                >
                    Login
                </button>
            </form>
        </div>
    )
}

export default LoginOwner