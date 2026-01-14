import { io } from 'socket.io-client';

// Detect if we're on mobile/network device and adjust Socket URL
const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  
  // If VITE_SOCKET_URL is set, use it
  if (envUrl) {
    console.log('[Socket] Using VITE_SOCKET_URL from env:', envUrl);
    return envUrl;
  }
  
  // Auto-detect if accessing from network (not localhost)
  const hostname = window.location.hostname;
  
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // We're accessing from network, use the same hostname
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

  console.log('[Socket] Initializing connection to:', SOCKET_URL);
  
  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected successfully');
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error);
    console.error('[Socket] Socket URL:', SOCKET_URL);
    console.error('[Socket] Current origin:', window.location.origin);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
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
