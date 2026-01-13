# Quick Start Guide - me-cha Chat App

## Prerequisites
- Node.js (v16+)
- MongoDB (running on localhost:27017)
- Redis (optional, for scalability)

## Step 1: Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

Backend will run on `http://localhost:5000`

## Step 2: Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3000`

## Step 3: Start MongoDB

If MongoDB is not running:

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or start MongoDB service
sudo systemctl start mongod
```

## Step 4: (Optional) Start Redis

For scalability features:

```bash
# Using Docker
docker run -d -p 6379:6379 --name redis redis:latest

# Or start Redis service
redis-server
```

## Step 5: Use the App

1. Open `http://localhost:3000` in your browser
2. Register a new account
3. Login
4. Start chatting!

## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running
- Check MONGODB_URI in backend/.env

### Socket Connection Error
- Ensure backend is running on port 5000
- Check CORS settings in backend/server.js

### File Upload Issues
- Check uploads directory exists in backend/
- Verify file size limits in backend/.env

## Features to Test

1. ✅ Register/Login
2. ✅ Send text messages
3. ✅ Upload and share images
4. ✅ Upload and share audio files
5. ✅ Upload and share video files
6. ✅ See online/offline status
7. ✅ Typing indicators
8. ✅ Emoji picker
9. ✅ Read receipts

Enjoy chatting! 🎉
