/**
 * Logging utility
 * Provides structured logging with different levels
 */

const logLevels = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLogLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');

const shouldLog = (level) => {
  return logLevels[level] <= logLevels[currentLogLevel];
};

const formatLog = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    level,
    message,
    ...data,
  };
};

const logger = {
  error: (message, data = {}) => {
    if (shouldLog('ERROR')) {
      console.error(JSON.stringify(formatLog('ERROR', message, data)));
    }
  },

  warn: (message, data = {}) => {
    if (shouldLog('WARN')) {
      console.warn(JSON.stringify(formatLog('WARN', message, data)));
    }
  },

  info: (message, data = {}) => {
    if (shouldLog('INFO')) {
      console.log(JSON.stringify(formatLog('INFO', message, data)));
    }
  },

  debug: (message, data = {}) => {
    if (shouldLog('DEBUG')) {
      console.log(JSON.stringify(formatLog('DEBUG', message, data)));
    }
  },
};

module.exports = logger;
