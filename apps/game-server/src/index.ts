import { loadConfig } from './config.js';
import { createServer } from './server.js';

let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// Colyseus shuts down gracefully on SIGTERM/SIGINT by itself.
await createServer(config).listen(config.PORT);
