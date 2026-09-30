import { createDatabase } from '@mathgo/db';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
const database = createDatabase(config.DATABASE_URL);
const app = buildApp(config, { db: database.db });
app.addHook('onClose', () => database.close());

// Docker sends SIGTERM on stop: finish in-flight requests, then exit.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'shutting down');
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, 'shutdown failed');
        process.exit(1);
      },
    );
  });
}

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.fatal({ err: error }, 'failed to start');
  process.exit(1);
}
