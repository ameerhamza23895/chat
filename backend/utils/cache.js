/**
 * Caching utility using Redis or in-memory fallback
 */

let cacheClient = null;
let memoryCache = new Map();
const CACHE_TTL = 60 * 60; // 1 hour default TTL

// Initialize Redis client if available
const initCache = async () => {
  if (process.env.REDIS_HOST && process.env.REDIS_PORT) {
    try {
      const { createClient } = require('redis');
      cacheClient = createClient({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      });

      await cacheClient.connect();
      console.log('[Cache] Redis connected');
      return cacheClient;
    } catch (error) {
      console.warn('[Cache] Redis not available, using in-memory cache:', error.message);
      cacheClient = null;
    }
  }
  return null;
};

// Get value from cache
const get = async (key) => {
  try {
    if (cacheClient) {
      const value = await cacheClient.get(key);
      return value ? JSON.parse(value) : null;
    } else {
      const cached = memoryCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
      memoryCache.delete(key);
      return null;
    }
  } catch (error) {
    console.error('[Cache] Get error:', error);
    return null;
  }
};

// Set value in cache
const set = async (key, value, ttl = CACHE_TTL) => {
  try {
    if (cacheClient) {
      await cacheClient.setEx(key, ttl, JSON.stringify(value));
    } else {
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttl * 1000,
      });
    }
  } catch (error) {
    console.error('[Cache] Set error:', error);
  }
};

// Delete value from cache
const del = async (key) => {
  try {
    if (cacheClient) {
      await cacheClient.del(key);
    } else {
      memoryCache.delete(key);
    }
  } catch (error) {
    console.error('[Cache] Delete error:', error);
  }
};

// Delete multiple keys by pattern
const delPattern = async (pattern) => {
  try {
    if (cacheClient) {
      const keys = await cacheClient.keys(pattern);
      if (keys.length > 0) {
        await cacheClient.del(keys);
      }
    } else {
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          memoryCache.delete(key);
        }
      }
    }
  } catch (error) {
    console.error('[Cache] Delete pattern error:', error);
  }
};

// Clear all cache
const clear = async () => {
  try {
    if (cacheClient) {
      await cacheClient.flushDb();
    } else {
      memoryCache.clear();
    }
  } catch (error) {
    console.error('[Cache] Clear error:', error);
  }
};

// Cleanup expired entries from memory cache
setInterval(() => {
  if (!cacheClient) {
    const now = Date.now();
    for (const [key, cached] of memoryCache.entries()) {
      if (cached.expiresAt <= now) {
        memoryCache.delete(key);
      }
    }
  }
}, 60 * 1000); // Cleanup every minute

module.exports = {
  initCache,
  get,
  set,
  del,
  delPattern,
  clear,
};
