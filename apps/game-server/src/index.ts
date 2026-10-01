import { loadConfig } from './config.js';
import { Redis } from 'ioredis';
import { RedisInviteStore } from './invites.js';
import { createServer } from './server.js';

let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// Colyseus shuts down gracefully on SIGTERM/SIGINT by itself.
const redis = new Redis(config.REDIS_URL);
await createServer(config, new RedisInviteStore(redis)).listen(config.PORT);
