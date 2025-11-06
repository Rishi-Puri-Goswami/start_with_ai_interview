import io from 'socket.io-client';

// Create socket without forcing the token at module-load time. We'll read token from
// localStorage when connecting and provide a helper to update it after login.
let socket = null;

function createSocket(tokenFromStorage) {
    // If already created, return it
    if (socket) return socket;

    socket = io(`${import.meta.env.VITE_API_URL}`, {
        withCredentials: true,
        auth: { token: tokenFromStorage || null },
        // allow polling fallback for environments where websocket handshake fails
        transports: ['websocket'],
        autoConnect: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    socket.on('connect', () => {
        console.log('✅ Connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
    });

    return socket;
}

// Initialize socket immediately using any token already in localStorage
const initialToken = localStorage.getItem('userToken') || null;
createSocket(initialToken);

// Helper to update auth token and reconnect the socket without a full page reload
export function setAuthToken(newToken) {
    try {
        if (!socket) {
            socket = createSocket(newToken);
            return;
        }
        // Disconnect cleanly, update auth, then reconnect
        if (socket.connected) {
            socket.disconnect();
        }
        socket.auth = { token: newToken || null };
        // Force a fresh connection which will include the new auth
        socket.connect();
        console.log('🔁 Socket auth token updated and reconnecting');
    } catch (err) {
        console.error('Failed to set socket auth token:', err);
    }
}

export default socket;


