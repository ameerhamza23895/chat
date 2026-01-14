#!/bin/bash

echo "=== Server Status Check ==="
echo ""

# Check if port 3000 is in use
echo "1. Checking if port 3000 is listening:"
if netstat -tlnp 2>/dev/null | grep :3000 > /dev/null || ss -tlnp 2>/dev/null | grep :3000 > /dev/null; then
    echo "   ✓ Port 3000 is in use"
    netstat -tlnp 2>/dev/null | grep :3000 || ss -tlnp 2>/dev/null | grep :3000
else
    echo "   ✗ Port 3000 is NOT in use - server might not be running"
fi

echo ""
echo "2. Checking certificates:"
if [ -f "certs/cert.pem" ] && [ -f "certs/key.pem" ]; then
    echo "   ✓ Certificates exist"
    ls -lh certs/
else
    echo "   ✗ Certificates missing - run ./generate-cert.sh"
fi

echo ""
echo "3. Testing local HTTPS connection:"
if curl -k -s -o /dev/null -w "%{http_code}" https://localhost:3000 2>/dev/null | grep -q "200\|301\|302"; then
    echo "   ✓ Server is responding on localhost"
else
    echo "   ✗ Server is NOT responding on localhost"
fi

echo ""
echo "4. Getting local IP address:"
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "   Your IP: $LOCAL_IP"

echo ""
echo "5. Testing network HTTPS connection:"
if [ -n "$LOCAL_IP" ]; then
    if curl -k -s -o /dev/null -w "%{http_code}" --connect-timeout 2 https://$LOCAL_IP:3000 2>/dev/null | grep -q "200\|301\|302"; then
        echo "   ✓ Server is responding on network IP"
    else
        echo "   ✗ Server is NOT responding on network IP"
        echo "   This might be a firewall issue"
    fi
fi

echo ""
echo "=== Check Complete ==="
echo ""
echo "If server is not responding:"
echo "  1. Make sure 'npm run dev' is running"
echo "  2. Check firewall: sudo ufw allow 3000/tcp"
echo "  3. Restart the server: npm run dev"
