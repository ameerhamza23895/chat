/**
 * Environment variable validation
 * Ensures all required environment variables are set
 */

const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const optionalEnvVars = {
  PORT: '5000',
  JWT_EXPIRE: '7d',
  NODE_ENV: 'development',
  REDIS_HOST: null,
  REDIS_PORT: null,
  UPLOAD_MAX_SIZE: '104857600', // 100MB
  FRONTEND_URL: 'http://localhost:3000',
  LOG_LEVEL: 'INFO',
};

const validateEnv = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check optional variables and set defaults
  for (const [envVar, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[envVar]) {
      if (defaultValue !== null) {
        process.env[envVar] = defaultValue;
        warnings.push(`${envVar} not set, using default: ${defaultValue}`);
      }
    }
  }

  // Validate JWT_SECRET strength in production
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters long in production');
    }
  }

  // Validate MongoDB URI format
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    warnings.push('MONGODB_URI should start with mongodb:// or mongodb+srv://');
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => console.error(`   - ${envVar}`));
    console.error('\nPlease set these variables in your .env file');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  console.log('✅ Environment variables validated');
};

module.exports = validateEnv;
