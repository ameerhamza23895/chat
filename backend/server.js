const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const initializeSocket = require('./socket/socketHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io setup with Redis adapter for scalability (optional)
let io;
if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
  const { createAdapter } = require('@socket.io/redis-adapter');
  const { createClient } = require('redis');
  
  try {
    const pubClient = createClient({ 
      host: process.env.REDIS_HOST, 
      port: process.env.REDIS_PORT 
    });
    const subClient = pubClient.duplicate();
    
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io = socketIo(server, {
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:3000',
          methods: ['GET', 'POST'],
          credentials: true,
        },
      });
      
      io.adapter(createAdapter(pubClient, subClient));
      initializeSocket(io);
      console.log('Socket.io with Redis adapter initialized');
    }).catch(err => {
      console.log('Redis not available, using default adapter');
      io = socketIo(server, {
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:3000',
          methods: ['GET', 'POST'],
          credentials: true,
        },
      });
      initializeSocket(io);
    });
  } catch (error) {
    console.log('Redis not available, using default adapter');
    io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    initializeSocket(io);
  }
} else {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  initializeSocket(io);
}

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
