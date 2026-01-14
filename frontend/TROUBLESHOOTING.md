# Troubleshooting HTTPS Development Server

If the page is not responding when accessing via `https://192.168.1.24:3000/`, try these steps:

## 1. Check if Server is Running

```bash
# Check if port 3000 is listening
netstat -tlnp | grep :3000
# or
ss -tlnp | grep :3000
```

## 2. Restart the Development Server

**Stop the current server** (Ctrl+C in the terminal where it's running), then:

```bash
cd /home/kali/dev/me-cha/frontend
npm run dev
```

Look for these messages in the output:
- `✓ Using custom self-signed certificates from certs/ directory`
- `Local:   https://localhost:3000/`
- `Network: https://192.168.1.24:3000/`

## 3. Check Firewall

Your firewall might be blocking port 3000. Check and allow it:

```bash
# For UFW (Ubuntu/Debian)
sudo ufw allow 3000/tcp
sudo ufw status

# For firewalld (CentOS/RHEL)
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload

# For iptables
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

## 4. Verify Certificates

Make sure certificates exist and are valid:

```bash
ls -la certs/
# Should show cert.pem and key.pem

# Test certificate
openssl x509 -in certs/cert.pem -text -noout | grep -i "subject\|issuer\|valid"
```

## 5. Test Connection Locally First

Try accessing from the same machine:
- `https://localhost:3000` - should work
- `https://127.0.0.1:3000` - should work

If localhost works but network IP doesn't, it's likely a firewall issue.

## 6. Check Browser Console

Open browser DevTools (F12) and check:
- Console tab for errors
- Network tab to see if requests are being made
- Security tab to see certificate details

## 7. Verify Server Binding

The server should be bound to `0.0.0.0:3000` (all interfaces), not just `127.0.0.1:3000`.

Check with:
```bash
netstat -tlnp | grep :3000
# Should show: 0.0.0.0:3000 or :::3000 (not just 127.0.0.1:3000)
```

## 8. Regenerate Certificates

If certificates are corrupted, regenerate them:

```bash
rm -rf certs
./generate-cert.sh
npm run dev
```

## 9. Check Vite Logs

Look at the terminal where `npm run dev` is running. Check for:
- Error messages
- Whether HTTPS is enabled
- What URL the server is listening on

## Common Issues

### Issue: "This site can't be reached" or "Connection refused"
**Solution**: Server not running or firewall blocking. Check steps 1 and 3.

### Issue: "NET::ERR_CERT_AUTHORITY_INVALID" or "Your connection is not private"
**Solution**: This is normal for self-signed certificates. Click "Advanced" → "Proceed anyway".

### Issue: Page loads but API calls fail
**Solution**: Check that backend server is running on port 5000 and CORS is configured.

### Issue: Works on localhost but not on network IP
**Solution**: Check firewall (step 3) and ensure server is bound to 0.0.0.0 (step 7).

## Still Not Working?

1. Check all terminal output when starting the server
2. Try accessing from a different device/browser
3. Verify your IP address: `hostname -I`
4. Try accessing with HTTP first to test connectivity: `http://192.168.1.24:3000` (will fail HTTPS but confirms server is reachable)
