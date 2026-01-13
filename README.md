# me-cha - Full Stack MERN Chat Application

A scalable, real-time chat application built with MongoDB, Express, React, and Node.js (MERN stack) with support for file, audio, and video sharing.

## Features

- ✅ Real-time messaging with Socket.io
- ✅ File sharing (images, documents)
- ✅ Audio sharing and playback
- ✅ Video sharing and playback
- ✅ User authentication (JWT)
- ✅ Online/offline status
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Emoji picker
- ✅ Modern, responsive UI
- ✅ Scalable architecture with Redis support

## Tech Stack

### Backend
- Node.js & Express
- MongoDB with Mongoose
- Socket.io for real-time communication
- Redis adapter for scalability (optional)
- Multer for file uploads
- JWT for authentication
- Bcrypt for password hashing

### Frontend
- React 18
- Vite
- Socket.io-client
- React Router
- Tailwind CSS
- Emoji Picker
- React Player (for video/audio)
- Axios

## Project Structure

```
me-cha/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── messageController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Message.js
│   │   └── Chat.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── messageRoutes.js
│   │   ├── userRoutes.js
│   │   └── uploadRoutes.js
│   ├── socket/
│   │   └── socketHandler.js
│   ├── uploads/
│   │   ├── images/
│   │   ├── audio/
│   │   ├── videos/
│   │   └── files/
│   ├── server.js
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── ChatList.jsx
    │   │   ├── ChatWindow.jsx
    │   │   └── Profile.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── utils/
    │   │   ├── api.js
    │   │   └── socket.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    └── vite.config.js
```

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v5 or higher)
- Redis (optional, for scalability)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/mecha
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d
REDIS_HOST=localhost
REDIS_PORT=6379
NODE_ENV=development
UPLOAD_MAX_SIZE=104857600
FRONTEND_URL=http://localhost:3000
```

5. Start MongoDB:
```bash
# On Linux/Mac
mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

6. (Optional) Start Redis for scalability:
```bash
# On Linux/Mac
redis-server

# Or using Docker
docker run -d -p 6379:6379 --name redis redis:latest
```

7. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional, defaults are set):
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Start Chatting**: Select a user from the chat list or search for new users
3. **Send Messages**: Type and send text messages
4. **Share Files**: Click the paperclip icon to upload and share files
5. **Share Media**: Upload images, audio, or video files - they will be displayed inline
6. **Emoji**: Click the smile icon to add emojis to your messages
7. **Profile**: Update your avatar and view profile information

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Messages
- `POST /api/messages/send` - Send a message
- `GET /api/messages/:userId` - Get messages with a user
- `GET /api/messages/chats/all` - Get all chats
- `PUT /api/messages/read/:messageId` - Mark message as read

### Users
- `GET /api/users/all` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users/avatar` - Update avatar

### Upload
- `POST /api/upload/file` - Upload a file

## Socket Events

### Client to Server
- `send-message` - Send a message
- `typing` - Send typing indicator
- `mark-read` - Mark message as read

### Server to Client
- `receive-message` - Receive a new message
- `message-sent` - Confirmation of sent message
- `user-typing` - User typing indicator
- `user-online` - User came online
- `user-offline` - User went offline
- `message-read` - Message was read

## Scalability Features

- **Redis Adapter**: Socket.io can use Redis adapter for horizontal scaling
- **Clustering**: Backend can be run in cluster mode for better performance
- **File Storage**: Files are organized by type (images, audio, video, files)
- **Database Indexing**: Optimized queries with proper indexes
- **Rate Limiting**: Built-in rate limiting support

## Production Deployment

1. Set `NODE_ENV=production` in backend `.env`
2. Update `FRONTEND_URL` with your production frontend URL
3. Use a strong `JWT_SECRET`
4. Set up MongoDB Atlas or production MongoDB instance
5. Configure Redis for production (optional but recommended)
6. Use a reverse proxy (Nginx) for serving static files
7. Set up SSL/TLS certificates
8. Configure CORS properly
9. Use environment variables for all sensitive data

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
