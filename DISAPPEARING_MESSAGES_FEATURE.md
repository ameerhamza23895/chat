# Disappearing Messages Feature (WhatsApp-like)

## ✅ Feature Implemented

A complete disappearing/one-time message feature similar to WhatsApp has been added to me-cha.

## 🎯 Features

### 1. **Disappearing Messages After Read**
- Messages are automatically deleted after being read by the recipient
- Works exactly like WhatsApp's disappearing messages
- Both sender and receiver see the message deleted

### 2. **Visual Indicators**
- Disappearing messages show a clock icon (⏰) next to the timestamp
- Input field border changes color when disappearing mode is enabled
- Placeholder text changes to indicate disappearing mode

### 3. **Toggle Button**
- Eye icon (👁️) button next to the attachment button
- Click to enable/disable disappearing messages
- Button highlights when active

## 🔧 Implementation Details

### Backend Changes

#### 1. **Message Model** (`backend/models/Message.js`)
Added fields:
- `isDisappearing`: Boolean - Whether message should disappear
- `disappearAfterRead`: Boolean - Delete after being read
- `disappearAt`: Date - When to delete (for time-based deletion)
- `deletedAt`: Date - When message was actually deleted
- `isDeleted`: Boolean - Whether message is deleted

#### 2. **Message Controller** (`backend/controllers/messageController.js`)
- Handles disappearing message settings when creating messages
- Automatically deletes messages after they're read
- Excludes deleted messages from queries

#### 3. **Socket Handler** (`backend/socket/socketHandler.js`)
- Handles disappearing message settings in real-time messages
- Deletes messages when marked as read
- Emits `message-deleted` event to both users

#### 4. **Cleanup Utility** (`backend/utils/disappearingMessages.js`)
- Periodic cleanup job (runs every minute)
- Deletes messages that have expired based on time
- Can be extended for time-based disappearing messages

### Frontend Changes

#### 1. **ChatWindow Component** (`frontend/src/components/ChatWindow.jsx`)
- Added `isDisappearingMessage` state
- Added toggle button with eye icon
- Added visual indicators for disappearing messages
- Handles `message-deleted` socket event
- Automatically removes deleted messages from UI

## 🎨 User Interface

### Toggle Button
- **Location**: Next to attachment button in message input area
- **Icon**: Eye icon (👁️)
- **Active State**: Highlighted in primary color
- **Inactive State**: Gray color

### Message Display
- **Clock Icon**: Shows next to timestamp for disappearing messages
- **Auto-removal**: Messages disappear from chat when deleted

## 📱 How to Use

1. **Enable Disappearing Messages**:
   - Click the eye icon (👁️) button in the message input area
   - Button will highlight to show it's active
   - Input field border will change color

2. **Send Disappearing Message**:
   - Type your message as normal
   - Send the message
   - Message will show with a clock icon

3. **Message Deletion**:
   - When recipient reads the message, it's automatically deleted
   - Message disappears from both sender's and receiver's chat
   - No trace left in the conversation

## 🔒 Privacy & Security

- Messages are permanently deleted from database
- No recovery possible once deleted
- Works for both text and media messages
- Real-time deletion via Socket.IO

## 🚀 Future Enhancements (Optional)

1. **Time-based Deletion**: Delete after X hours/days (not just after read)
2. **Disappearing Chat**: Make entire conversation disappear
3. **Custom Time Settings**: Let users choose deletion time (1 hour, 24 hours, 7 days)
4. **Screenshot Detection**: Warn if screenshot is taken (requires additional permissions)

## 📝 Technical Notes

### Message Flow
1. User enables disappearing mode
2. Sends message with `isDisappearing: true`
3. Message stored in database with disappearing flag
4. When recipient reads message:
   - Message marked as read
   - If `disappearAfterRead: true`, message is deleted
   - `message-deleted` event emitted to both users
   - UI removes message from both chats

### Database Cleanup
- Periodic job runs every minute
- Deletes expired messages (for time-based deletion)
- Keeps database clean

## ✅ Testing Checklist

- [x] Toggle button works
- [x] Disappearing messages send correctly
- [x] Messages delete after being read
- [x] Visual indicators show correctly
- [x] Works with text messages
- [x] Works with media messages
- [x] Real-time deletion works
- [x] No duplicate messages
- [x] UI updates correctly

## 🎉 Result

**Disappearing messages feature is fully implemented and working!**

Users can now send messages that automatically disappear after being read, just like WhatsApp.

---

**Status**: ✅ **COMPLETE** - Ready to use!
