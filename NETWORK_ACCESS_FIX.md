# Network Access Fix - Troubleshooting

## What Was Changed

The frontend now automatically detects whether you're accessing via:
- **Localhost** (`localhost` or `127.0.0.1`): Uses Vite proxy → `http://localhost:5000`
- **IP Address** (e.g., `192.168.1.100`): Connects directly → `http://192.168.1.100:5000`

## If Localhost Is Not Working

### 1. Restart Frontend Dev Server
The changes require a restart:
```bash
# Stop the current server (Ctrl+C)
cd /home/kali/dev/me-cha/frontend
npm run dev
```

### 2. Check Backend Is Running
```bash
# Check if backend is running on port 5000
curl http://localhost:5000/api/health
# Should return: {"status":"OK","timestamp":"..."}
```

If not running:
```bash
cd /home/kali/dev/me-cha/backend
npm start
```

### 3. Check Browser Console
Open DevTools (F12) and check:
- Console tab for `[API]` and `[Socket]` logs
- Network tab to see if requests are being made
- Look for errors like:
  - `ERR_CONNECTION_REFUSED` → Backend not running
  - `ERR_EMPTY_RESPONSE` → Proxy issue
  - `CORS error` → Backend CORS misconfigured

### 4. Clear Browser Cache
- Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- Or clear cache and cookies

### 5. Verify Vite Proxy Configuration
Check `frontend/vite.config.js` - proxy should target `http://localhost:5000`

### 6. Test Direct Backend Connection
Open in browser: `http://localhost:5000/api/health`
- If this works → Backend is fine, issue is with frontend/proxy
- If this fails → Backend is not running or not accessible

### 7. Check What URL Is Being Used
In browser console, you should see:
```
[API] Localhost detected - Using relative URL (via Vite proxy): /api
[API] Final API URL: /api
[Socket] Localhost detected - Using relative URL (via Vite proxy): 
[Socket] Final Socket URL: 
```

If you see different URLs, there might be a detection issue.

## Expected Behavior

### Localhost Access (`https://localhost:3000`)
- API: Uses `/api` (relative) → Vite proxy → `http://localhost:5000/api`
- Socket: Uses `window.location.origin` → Vite proxy → `http://localhost:5000`

### IP Access (`https://192.168.1.100:3000`)
- API: Uses `http://192.168.1.100:5000/api` (direct)
- Socket: Uses `http://192.168.1.100:5000` (direct)

## Still Not Working?

1. Share the browser console output (all `[API]` and `[Socket]` logs)
2. Share the Network tab showing failed requests
3. Verify backend is running: `curl http://localhost:5000/api/health`
4. Check if Vite dev server shows any proxy errors
