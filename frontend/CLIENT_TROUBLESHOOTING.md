# Client-Side Troubleshooting for ERR_EMPTY_RESPONSE

The server is working correctly (tested and responding). If you're getting `ERR_EMPTY_RESPONSE` in your browser, try these steps:

## 1. Clear Browser Cache and Cookies

**Chrome/Edge:**
- Press `Ctrl+Shift+Delete` (or `Cmd+Shift+Delete` on Mac)
- Select "Cached images and files" and "Cookies"
- Click "Clear data"

**Firefox:**
- Press `Ctrl+Shift+Delete`
- Select "Cache" and "Cookies"
- Click "Clear Now"

## 2. Try a Different Browser

Test in a different browser to rule out browser-specific issues:
- Chrome
- Firefox
- Edge
- Safari (if on Mac/iOS)

## 3. Accept the Certificate Warning Properly

When accessing `https://192.168.1.24:3000`:
1. You'll see a "Your connection is not private" or "Advanced" warning
2. Click **"Advanced"** or **"Show Details"**
3. Click **"Proceed to 192.168.1.24 (unsafe)"** or **"Accept the Risk and Continue"**
4. Don't just click "Back to safety"

## 4. Try in Incognito/Private Mode

Open an incognito/private window and try:
```
https://192.168.1.24:3000
```

This bypasses extensions and cached data.

## 5. Check Browser Console for Errors

1. Open DevTools (F12)
2. Go to the **Console** tab
3. Try accessing the URL
4. Look for error messages
5. Share any errors you see

## 6. Try HTTP First (to test connectivity)

Try accessing with HTTP (without the 's'):
```
http://192.168.1.24:3000
```

**Note:** This will fail for video calls (needs HTTPS), but it tests if your device can reach the server.

If HTTP works but HTTPS doesn't:
- It's a certificate/HTTPS issue
- Make sure you're accepting the certificate warning properly

If HTTP also fails:
- Check if you're on the same network
- Check firewall on your device (not just server)

## 7. Check Device Firewall/Antivirus

Your device's firewall or antivirus might be blocking the connection:
- Temporarily disable firewall/antivirus
- Try accessing again
- If it works, add an exception for the connection

## 8. Verify Network Connection

Make sure both devices are on the same network:
- Server: Check IP with `hostname -I`
- Client: Check your device's IP
- Both should be on the same subnet (e.g., 192.168.1.x)

## 9. Try Using IP Address Directly

Some browsers cache DNS. Try:
```
https://192.168.1.24:3000
```

Instead of any hostname.

## 10. Check for Proxy Settings

If you're behind a proxy:
1. Disable proxy in browser settings
2. Or configure proxy to allow local IPs

## 11. Mobile Devices - Special Steps

**Android:**
1. Accept certificate in Chrome
2. Go to Settings → Security → Trusted Credentials
3. Or try Chrome and accept the warning

**iOS:**
1. Access the URL in Safari
2. Tap "Advanced"
3. Tap "Proceed to 192.168.1.24"
4. You may need to install the certificate profile

## Quick Test Commands

On your device (client), you can test with:

**Windows (PowerShell):**
```powershell
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
Invoke-WebRequest -Uri "https://192.168.1.24:3000" -SkipCertificateCheck
```

**Mac/Linux:**
```bash
curl -k https://192.168.1.24:3000
```

If these work but the browser doesn't, it's definitely a browser issue.

## Most Common Solution

**90% of the time, this fixes it:**
1. Close all browser tabs with the URL
2. Clear browser cache (step 1)
3. Open a new incognito/private window
4. Go to `https://192.168.1.24:3000`
5. Click "Advanced" → "Proceed anyway" when you see the certificate warning
6. The page should load
