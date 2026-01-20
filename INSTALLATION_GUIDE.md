# Installation Guide - Optimized me-cha

This guide will help you install and set up the optimized version of me-cha.

## 📦 New Dependencies

The optimization added one new dependency:

### Backend
- `joi` (^17.11.0) - Input validation library

## 🚀 Installation Steps

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

This will install the new `joi` package along with all existing dependencies.

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

No new frontend dependencies were added.

### 3. Environment Variables

Ensure your `.env` file in the `backend` directory includes:

```env
# Required
MONGODB_URI=mongodb://localhost:27017/mecha
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Optional (with defaults)
PORT=5000
JWT_EXPIRE=7d
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
UPLOAD_MAX_SIZE=104857600
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=INFO
```

### 4. Redis Setup (Optional but Recommended)

For optimal performance, Redis is recommended:

```bash
# Using Docker
docker run -d -p 6379:6379 --name redis redis:latest

# Or install locally
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
```

If Redis is not available, the application will automatically fall back to in-memory caching.

### 5. Start the Application

#### Backend
```bash
cd backend
npm run dev
```

#### Frontend
```bash
cd frontend
npm run dev
```

## ✅ Verification

After starting the application, you should see:

1. **Backend console**:
   - ✅ Environment variables validated
   - MongoDB Connected
   - [Cache] Redis connected (if Redis is running)
   - Server running on 0.0.0.0:5000

2. **Frontend**: Should load at http://localhost:3000

## 🔍 Testing the Optimizations

### Test Rate Limiting
Try making more than 5 login attempts in 15 minutes - you should see rate limit errors.

### Test Caching
1. Make a request to `/api/users/all`
2. Make the same request again immediately
3. Check backend logs - second request should be faster (cached)

### Test Validation
Try registering with invalid data (e.g., invalid email) - you should see validation errors.

### Test Error Handling
Try accessing a non-existent endpoint - you should see a consistent error format.

## 🐛 Troubleshooting

### "joi is not defined" Error
- Run `npm install` in the backend directory
- Ensure `joi` is in `package.json`

### Redis Connection Errors
- This is normal if Redis is not installed
- The app will use in-memory caching instead
- For production, Redis is recommended

### Environment Validation Errors
- Check that all required environment variables are set
- See the error message for which variables are missing

### Rate Limiting Too Strict
- Adjust limits in `backend/middleware/rateLimiter.js`
- Or disable for development in `backend/server.js`

## 📚 Next Steps

1. Review `OPTIMIZATION_SUMMARY.md` for details on all improvements
2. Test the application thoroughly
3. Monitor performance improvements
4. Consider setting up Redis for production

---

**Note**: All optimizations are backward compatible. Existing functionality remains unchanged, with added performance and security improvements.
