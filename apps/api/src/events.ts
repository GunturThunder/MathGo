import { events } from '@mathgo/db';
import { analyticsEvent, eventBatch, type AnalyticsEvent } from '@mathgo/protocol';
import type { FastifyInstance } from 'fastify';
import { authenticate, type AuthDeps } from './auth.js';
import { ApiError } from './errors.js';

/**
 * POST /events (FR-09, S6-02): the app's analytics, in batches. Signed-in players only, so
 * nothing is collected from minors before a parent consents. Each event is checked on its own
 * against @mathgo/protocol: valid ones are stored, the rest dropped and counted.
 */
export function registerEventRoutes(app: FastifyInstance, deps: AuthDeps): void {
  app.post('/events', { bodyLimit: 64 * 1024 }, async (request, reply) => {
    const { userId } = await authenticate(request, deps);
    const batch = eventBatch.safeParse(request.body);
    if (!batch.success) {
      throw new ApiError(400, 'invalid-request', 'Send { events: [...] } with 1–50 events.');
    }
    const valid: AnalyticsEvent[] = [];
    for (const raw of batch.data.events) {
      const parsed = analyticsEvent.safeParse(raw);
      if (parsed.success) valid.push(parsed.data);
    }
    if (valid.length > 0) {
      await deps.db
        .insert(events)
        .values(valid.map((e) => ({ name: e.name, userId, props: e.props })));
    }
    const rejected = batch.data.events.length - valid.length;
    if (rejected > 0) request.log.info({ rejected }, 'analytics events dropped');
    return reply.status(202).send({ accepted: valid.length, rejected });
  });
}
