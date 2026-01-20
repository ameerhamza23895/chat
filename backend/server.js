const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Validate environment variables
const validateEnv = require('./utils/envValidator');
validateEnv();

const connectDB = require('./config/db');
const initializeSocket = require('./socket/socketHandler');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { initCache } = require('./utils/cache');
const logger = require('./utils/logger');
const messageController = require('./controllers/messageController');

// Import routes
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Connect to database
connectDB();

// Initialize cache
initCache().catch(err => {
  logger.warn('Cache initialization failed', { error: err.message });
});

// Start disappearing messages cleanup
const { startCleanupInterval } = require('./utils/disappearingMessages');
startCleanupInterval();

const app = express();
const server = http.createServer(app);

// CORS configuration for network access
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL) {
    // In production, use specific URL or allow all if ALLOW_ALL_ORIGINS is set
    if (process.env.ALLOW_ALL_ORIGINS === 'true') {
      console.log('[CORS] Allowing all origins (production mode with ALLOW_ALL_ORIGINS=true)');
      return true; // Allow all origins
    }
    const origins = process.env.FRONTEND_URL.split(',').map(url => url.trim());
    console.log('[CORS] Allowed origins (production):', origins);
    return origins;
  }
  // In development, allow all origins for network access
  console.log('[CORS] Development mode - Allowing all origins');
  return true;
};

// Custom CORS function for better logging
const corsWithLogging = (req, res, next) => {
  const origin = req.headers.origin;
  console.log(`[CORS] Request from origin: ${origin || 'no origin header'}`);
  console.log(`[CORS] Request method: ${req.method}`);
  console.log(`[CORS] Request path: ${req.path}`);
  
  const allowedOrigins = getAllowedOrigins();
  
  if (allowedOrigins === true || (origin && (allowedOrigins.includes(origin) || allowedOrigins === true))) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      console.log('[CORS] Preflight request - sending 200 OK');
      return res.sendStatus(200);
    }
    console.log('[CORS] Request allowed');
  } else {
    console.warn(`[CORS] Request blocked from origin: ${origin}`);
  }
  
  next();
};

const corsOptions = {
  origin: (origin, callback) => {
    console.log(`[CORS] Checking origin: ${origin || 'no origin'}`);
    const allowedOrigins = getAllowedOrigins();
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin || allowedOrigins === true) {
      callback(null, true);
      console.log('[CORS] Origin allowed');
    } else if (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin)) {
      callback(null, true);
      console.log('[CORS] Origin allowed');
    } else {
      console.warn(`[CORS] Origin blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

const socketCorsOptions = {
  origin: getAllowedOrigins(),
  methods: ['GET', 'POST'],
  credentials: true,
};

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
        cors: socketCorsOptions,
      });
      
      io.adapter(createAdapter(pubClient, subClient));
      initializeSocket(io);
      messageController.setIoInstance(io); // Pass io to message controller
      console.log('Socket.io with Redis adapter initialized');
    }).catch(err => {
      console.log('Redis not available, using default adapter');
      io = socketIo(server, {
        cors: socketCorsOptions,
      });
      initializeSocket(io);
      messageController.setIoInstance(io); // Pass io to message controller
    });
  } catch (error) {
    console.log('Redis not available, using default adapter');
    io = socketIo(server, {
      cors: socketCorsOptions,
    });
    initializeSocket(io);
    messageController.setIoInstance(io); // Pass io to message controller
  }
} else {
  io = socketIo(server, {
    cors: socketCorsOptions,
  });
  initializeSocket(io);
  messageController.setIoInstance(io); // Pass io to message controller
}

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  console.log(`  Origin: ${req.headers.origin || 'none'}`);
  console.log(`  User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'none'}...`);
  console.log(`  IP: ${req.ip || req.connection.remoteAddress}`);
  next();
});

// Middleware
// Configure helmet to work with network access
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

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

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Access from network: http://<your-ip>:${PORT}`);
    console.log(`Local access: http://localhost:${PORT}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
