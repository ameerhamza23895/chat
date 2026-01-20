# Debug Chat History Not Showing

## 🔍 Debugging Steps

### 1. Check Backend Logs

When you open a chat, you should see in backend console:
```
[INFO] Get messages request { userId: '...', currentUserId: '...', query: {} }
[INFO] Fetching messages with query { finalQuery: '...', userId: '...', currentUserId: '...' }
[INFO] Messages fetched { count: X, ... }
[INFO] Get messages response { messageCount: X, totalCount: Y, ... }
```

### 2. Check Frontend Console

When you open a chat, you should see in browser console:
```
[ChatWindow] Fetching messages for user: ...
[ChatWindow] Selected user object: ...
[ChatWindow] Messages response: { success: true, messages: [...], ... }
[ChatWindow] Received messages: X
```

### 3. Check Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Open a chat
4. Look for request to `/api/messages/{userId}`
5. Check:
   - Status code (should be 200)
   - Response body (should have `success: true` and `messages` array)

### 4. Common Issues

#### Issue 1: No messages in response
- **Check**: Backend logs show `messageCount: 0`
- **Cause**: Query might be filtering out all messages
- **Fix**: Check if `isDeleted` field exists on old messages

#### Issue 2: API returns error
- **Check**: Network tab shows error status (400, 401, 500)
- **Cause**: Authentication or validation error
- **Fix**: Check backend logs for error details

#### Issue 3: Messages array is empty
- **Check**: Response has `messages: []`
- **Cause**: No messages exist between users, or query is wrong
- **Fix**: Verify messages exist in database

#### Issue 4: Frontend not updating
- **Check**: Console shows messages received but UI doesn't update
- **Cause**: React state not updating
- **Fix**: Check React DevTools for state

## 🧪 Quick Test

Run this in backend directory to check messages:
```bash
node -e "const mongoose = require('mongoose'); const Message = require('./models/Message'); mongoose.connect('mongodb://localhost:27017/mecha').then(async () => { const msgs = await Message.find({}).limit(5).lean(); console.log('Sample messages:', msgs.map(m => ({id: m._id, sender: m.sender, receiver: m.receiver, content: m.content?.substring(0, 30), hasIsDeleted: 'isDeleted' in m}))); process.exit(0); });"
```

## 📝 What to Check

1. ✅ Backend is running on port 5000
2. ✅ MongoDB is running and connected
3. ✅ Messages exist in database
4. ✅ User is authenticated (token valid)
5. ✅ API endpoint returns 200 status
6. ✅ Response contains messages array
7. ✅ Frontend receives and processes messages

---

**If still not working**, share:
- Backend console logs when opening chat
- Browser console logs
- Network tab response for `/api/messages/{userId}`
