import { randomUUID } from 'node:crypto';
import { signingKey } from '@mathgo/auth';
import type { Database } from '@mathgo/db';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './auth.js';
import type { Config } from './config.js';
import { registerErrorHandlers } from './errors.js';
import { registerNicknameRoutes } from './nickname-routes.js';

export interface AppDeps {
  readonly db: Database;
  /** The clock; tests move it to expire tokens. */
  readonly now?: () => Date;
}

/** Builds the API without listening, so tests can call it with `app.inject()`. */
export function buildApp(config: Config, { db, now = () => new Date() }: AppDeps): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Structured JSON logs; tokens never reach them.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    // Keep a request id from the proxy if it sent one, so logs line up across services.
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    // Reject unknown fields instead of silently dropping them. Types still coerce, because
    // query strings are always text.
    ajv: { customOptions: { removeAdditional: false } },
  });

  registerErrorHandlers(app);

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  // Liveness for Docker and the uptime monitor: the process is up and serving.
  app.get('/health', async () => ({ status: 'ok' }));

  const auth = { db, key: signingKey(config.JWT_SECRET), now };
  registerAuthRoutes(app, auth);
  registerNicknameRoutes(app, auth);

  return app;
}
