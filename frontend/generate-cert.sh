#!/bin/bash

# Script to generate self-signed SSL certificates for development

echo "Generating self-signed SSL certificates for development..."

# Get local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo "Detected local IP: $LOCAL_IP"

# Create cert directory if it doesn't exist
mkdir -p certs

# Generate private key
echo "Generating private key..."
openssl genrsa -out certs/key.pem 2048

# Generate self-signed certificate with Subject Alternative Names
echo "Generating self-signed certificate..."

# Create OpenSSL config file
cat > certs/openssl.conf <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Development
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = $LOCAL_IP
EOF

# Generate certificate directly
openssl req -new -x509 -key certs/key.pem -out certs/cert.pem -days 365 -config certs/openssl.conf

# Clean up config file
rm certs/openssl.conf

echo ""
echo "✓ Certificates generated successfully!"
echo ""
echo "Certificate files:"
echo "  - certs/cert.pem (certificate)"
echo "  - certs/key.pem (private key)"
echo ""
echo "The certificate is valid for:"
echo "  - localhost"
echo "  - 127.0.0.1"
echo "  - $LOCAL_IP (your local network IP)"
echo ""
echo "Next steps:"
echo "  1. Restart your Vite dev server"
echo "  2. Access via https://localhost:3000 or https://$LOCAL_IP:3000"
echo "  3. Accept the browser security warning (normal for self-signed certs)"
echo ""
