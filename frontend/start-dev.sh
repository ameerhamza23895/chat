#!/bin/bash

# Development server startup script with HTTPS

echo "Starting Vite development server with HTTPS..."
echo ""
echo "The server will be available at:"
echo "  - Local: https://localhost:3000"
echo "  - Network: https://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Make sure you have generated SSL certificates by running: ./generate-cert.sh"
echo ""
echo "Starting server..."
echo ""

npm run dev
