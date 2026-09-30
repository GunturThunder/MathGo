import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { registerErrorHandlers } from './errors.js';

/** Builds the API without listening, so tests can call it with `app.inject()`. */
export function buildApp(config: Config): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Structured JSON logs; tokens never reach them.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    // Keep a request id from the proxy if it sent one, so logs line up across services.
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    disableRequestLogging: false,
  });

  registerErrorHandlers(app);

  app.addHook('onSend', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  // Liveness for Docker and the uptime monitor: the process is up and serving.
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
