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
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        autoConnect: true,
        reconnection: true,              // Enable auto-reconnection
        reconnectionAttempts: Infinity,  // Keep trying to reconnect
        reconnectionDelay: 1000,         // Start with 1s delay
        reconnectionDelayMax: 5000,      // Max 5s between attempts
        timeout: 20000,                  // Connection timeout
        forceNew: false                  // Reuse existing connection
    });

    socket.on('connect', () => {
        console.log('✅ Socket Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
        console.warn('⚠️ Socket Disconnected:', reason);
        if (reason === 'io server disconnect') {
            // Server forcibly disconnected, manually reconnect
            console.log('🔄 Server disconnected socket, attempting reconnect...');
            socket.connect();
        }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt #${attemptNumber}...`);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log(`✅ Reconnected successfully after ${attemptNumber} attempts`);
    });

    socket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed after all attempts');
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
    });

    socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
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