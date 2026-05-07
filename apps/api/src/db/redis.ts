import { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('redis');

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  log.info('Connected to Redis');
});

redis.on('error', (err) => {
  log.error('Redis connection error', { error: err.message });
});
