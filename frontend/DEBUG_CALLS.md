# Debugging Call Issues

If calls are not being sent or received, follow these debugging steps:

## 1. Check Socket Connection

Open browser console (F12) and check for:
- `[Socket] Connected successfully` - Socket is connected
- `[Socket] Connection error` - Socket connection failed
- `[ChatWindow] Socket connected: true` - Socket is available in ChatWindow

## 2. Test Call Initiation

When clicking the call button, check console for:
- `[ChatWindow] initiateCall called with type: video/audio`
- `[ChatWindow] Socket connected: true/false`
- `[ChatWindow] Emitting initiate-call event`
- `[Socket] Call initiated: ...` (backend log)

## 3. Test Call Reception

When receiving a call, check console for:
- `[Socket] Call initiated: ...` (backend log)
- `[Socket] Sending incoming-call to user_...` (backend log)
- `[ChatWindow] Incoming call received: ...` (frontend log)
- `[ChatWindow] Setting call state for incoming call` (frontend log)

## 4. Common Issues

### Issue: Socket not connected
**Symptoms**: `[ChatWindow] Socket not connected` in console
**Solution**: 
- Refresh the page
- Check if backend server is running
- Check network tab for WebSocket connection

### Issue: Call not received
**Symptoms**: Caller sees "calling" but receiver doesn't see incoming call
**Solution**:
- Check backend logs for `[Socket] Sending incoming-call to user_...`
- Verify receiver's socket is connected
- Check if receiverId matches the receiver's user ID

### Issue: Call state not updating
**Symptoms**: No CallWindow appears
**Solution**:
- Check `[ChatWindow] Call state set` in console
- Verify CallWindow component is rendering
- Check for React errors in console

## 5. Manual Test Commands

In browser console, test socket connection:

```javascript
// Get socket instance
const socket = window.socket || // if exposed globally

// Check connection
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);

// Test emit
socket.emit('initiate-call', {
  receiverId: 'USER_ID_HERE',
  callType: 'audio'
});
```

## 6. Backend Verification

Check backend terminal for:
- `User connected: username (userId)` - User is connected
- `[Socket] Call initiated: ...` - Call was received
- `[Socket] Sending incoming-call to user_...` - Call was forwarded

## 7. Network Issues

If using HTTPS proxy:
- Verify `/socket.io` is proxied correctly
- Check Vite proxy configuration
- Test WebSocket connection in Network tab
