import { loadConfig } from './config.js';
import { createDatabase } from '@mathgo/db';
import { Redis } from 'ioredis';
import { RedisInviteStore } from './invites.js';
import { DbMatchRecorder } from './match-recorder.js';
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
const database = createDatabase(config.DATABASE_URL);
await createServer(config, {
  invites: new RedisInviteStore(redis),
  recorder: new DbMatchRecorder(database.db),
}).listen(config.PORT);
