import axios from 'axios';

// Detect if we're on mobile/network device and adjust API URL
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If VITE_API_URL is set, use it
  if (envUrl) {
    console.log('[API] Using VITE_API_URL from env:', envUrl);
    return envUrl;
  }
  
  // Auto-detect if accessing from network (not localhost)
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (isLocalhost) {
    // Try to use relative URL first (goes through Vite proxy)
    // This avoids mixed content issues (HTTPS frontend -> HTTP backend)
    // If proxy fails, we can fall back to direct connection
    const apiUrl = '/api';
    console.log('[API] Localhost detected - Using relative URL (via Vite proxy):', apiUrl);
    console.log('[API] If this fails, backend might not be running or proxy misconfigured');
    return apiUrl;
  }
  
  // We're accessing from network (IP address), connect directly to backend
  // Use HTTP (not HTTPS) because backend runs on HTTP
  // Extract IP from current hostname
  const backendUrl = `http://${hostname}:5000/api`;
  console.log('[API] Network access detected (IP:', hostname, ') - Connecting directly to backend:', backendUrl);
  return backendUrl;
};

const API_URL = getApiUrl();

console.log('[API] Final API URL:', API_URL);
console.log('[API] Current location:', window.location.href);

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000, // 10 second timeout
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('[API] Request:', config.method?.toUpperCase(), config.url, {
      baseURL: config.baseURL,
      withCredentials: config.withCredentials,
      hasToken: !!token,
    });
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      message: error.message,
      code: error.code,
    });
    
    if (error.response?.status === 401) {
      console.log('[API] Unauthorized - clearing token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // CORS error detection
    if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
      console.error('[API] CORS or Network Error detected!');
      console.error('  API URL:', API_URL);
      console.error('  Current origin:', window.location.origin);
      console.error('  Make sure backend CORS is configured to allow:', window.location.origin);
      
      // If using proxy and it fails, suggest checking backend
      if (API_URL === '/api') {
        console.error('[API] Proxy connection failed. Check:');
        console.error('  1. Backend server is running on http://localhost:5000');
        console.error('  2. Vite dev server proxy is configured correctly');
        console.error('  3. Try accessing http://localhost:5000/api/health directly');
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
