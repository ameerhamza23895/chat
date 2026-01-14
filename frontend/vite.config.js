import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Function to get HTTPS options with self-signed certificates
const getHttpsOptions = () => {
  const certPath = path.resolve(__dirname, 'certs/cert.pem');
  const keyPath = path.resolve(__dirname, 'certs/key.pem');

  // Check if custom certificates exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);
      console.log('✓ Using custom self-signed certificates from certs/ directory');
      return {
        key: key,
        cert: cert,
      };
    } catch (error) {
      console.error('⚠ Error reading certificates:', error.message);
      console.log('⚠ Falling back to Vite auto-generated certificate.');
      return true;
    }
  }

  // Fallback to Vite's auto-generated certificate
  console.log('⚠ No custom certificates found. Using Vite auto-generated certificate.');
  console.log('  Run ./generate-cert.sh to generate custom certificates for network access.');
  return true;
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    https: getHttpsOptions(), // Enable HTTPS with self-signed certificates
    host: '0.0.0.0', // Bind to all interfaces (important for network access)
    strictPort: false, // Allow port changes if 3000 is in use
    hmr: {
      protocol: 'wss', // Use secure WebSocket for HMR
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false, // Backend doesn't need SSL, only frontend
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false, // Backend doesn't need SSL, only frontend
      },
    },
  },
});
