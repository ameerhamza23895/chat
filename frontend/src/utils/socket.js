import { io } from 'socket.io-client';

// Detect if we're on mobile/network device and adjust Socket URL
const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  
  // If VITE_SOCKET_URL is set, use it
  if (envUrl) {
    console.log('[Socket] Using VITE_SOCKET_URL from env:', envUrl);
    return envUrl;
  }
  
  // Use relative URL to go through Vite proxy (works with HTTPS)
  // This avoids mixed content issues (HTTPS frontend -> HTTP backend)
  const useProxy = true;
  
  if (useProxy) {
    // Use relative path - Vite proxy will handle it
    const socketUrl = '';
    console.log('[Socket] Using relative URL (via Vite proxy):', socketUrl || 'current origin');
    return socketUrl;
  }
  
  // Auto-detect if accessing from network (not localhost)
  const hostname = window.location.hostname;
  
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // We're accessing from network, use the same hostname and protocol
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const socketUrl = `${protocol}//${hostname}:5000`;
    console.log('[Socket] Network access detected, using:', socketUrl);
    return socketUrl;
  }
  
  // Default to localhost
  const defaultUrl = 'http://localhost:5000';
  console.log('[Socket] Using default localhost URL:', defaultUrl);
  return defaultUrl;
};

const SOCKET_URL = getSocketUrl();

console.log('[Socket] Final Socket URL:', SOCKET_URL);

let socket = null;

export const initSocket = (token) => {
  if (socket?.connected) {
    console.log('[Socket] Reusing existing connection');
    return socket;
  }

  // Use empty string or undefined for relative URL (goes through Vite proxy)
  const socketOptions = {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  };

  // If SOCKET_URL is empty, use current origin (goes through Vite proxy)
  // Otherwise use the provided URL
  let socketUrl;
  if (!SOCKET_URL || SOCKET_URL === '') {
    // Use current origin - Vite proxy will handle /socket.io
    socketUrl = window.location.origin;
    socketOptions.path = '/socket.io';
  } else {
    socketUrl = SOCKET_URL;
    socketOptions.path = undefined; // Use default path
  }

  console.log('[Socket] Initializing connection to:', socketUrl);
  console.log('[Socket] Socket options:', socketOptions);
  
  socket = io(socketUrl, socketOptions);

  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected successfully');
    console.log('[Socket] Socket ID:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] ❌ Connection error:', error);
    console.error('[Socket] Socket URL:', SOCKET_URL);
    console.error('[Socket] Current origin:', window.location.origin);
    console.error('[Socket] Error details:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] ⚠️ Disconnected:', reason);
  });

  // Add event listeners for debugging
  socket.onAny((eventName, ...args) => {
    if (eventName.startsWith('call') || eventName === 'incoming-call') {
      console.log('[Socket] 📞 Call event received:', eventName, args);
    }
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
