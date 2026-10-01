import { eq, events } from '@mathgo/db';
import { createTestDatabase } from '@mathgo/db/testing';
import { ANALYTICS_EVENT_NAMES, type AnalyticsEvent } from '@mathgo/protocol';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const database = await createTestDatabase();
const app = buildApp(loadConfig({ LOG_LEVEL: 'silent' }), { db: database.db });
afterAll(async () => {
  await app.close();
  await database.close();
});

async function guest() {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/guest',
    payload: { birthYear: 1995 },
  });
  return res.json<{ accessToken: string; user: { id: string } }>();
}

const post = (token: string | null, payload: unknown) =>
  app.inject({
    method: 'POST',
    url: '/events',
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
    payload: payload as object,
  });

/** What one short session of the app would send: a random battle and an invite. */
const session: AnalyticsEvent[] = [
  { name: 'queue_wait', props: { waitedMs: 4_200, outcome: 'matched' } },
  { name: 'battle_start', props: { mode: 'ranked', arena: 1 } },
  {
    name: 'battle_end',
    props: {
      mode: 'ranked',
      arena: 1,
      outcome: 'win',
      reason: 'ko',
      durationMs: 61_000,
      correct: 9,
      wrong: 2,
    },
  },
  { name: 'invite_create', props: {} },
  { name: 'invite_join', props: { result: 'joined' } },
  { name: 'consent_step', props: { step: 'started' } },
];

describe('POST /events (S6-02)', () => {
  it('Done when: each event type appears after a test session', async () => {
    const { accessToken, user } = await guest();
    const res = await post(accessToken, { events: session });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: session.length, rejected: 0 });

    const rows = await database.db.select().from(events).where(eq(events.userId, user.id));
    // Every event type the protocol defines arrived, with its properties and the player's id.
    expect(new Set(rows.map((r) => r.name))).toEqual(new Set(ANALYTICS_EVENT_NAMES));
    expect(rows.find((r) => r.name === 'battle_end')?.props).toEqual(session[2]?.props);
  });

  it('drops anything that could carry personal data or is unknown, and keeps the rest', async () => {
    const { accessToken, user } = await guest();
    const res = await post(accessToken, {
      events: [
        { name: 'invite_create', props: {} }, // fine
        { name: 'invite_create', props: { phone: '0812345678' } }, // extra field
        { name: 'queue_wait', props: { waitedMs: 'long', outcome: 'matched' } }, // not a number
        { name: 'invite_join', props: { result: 'Budi typed this' } }, // free text
        { name: 'screen_view', props: { screen: 'home' } }, // unknown event
        'garbage',
      ],
    });
    expect(res.json()).toEqual({ accepted: 1, rejected: 5 });
    const rows = await database.db.select().from(events).where(eq(events.userId, user.id));
    expect(rows.map((r) => [r.name, r.props])).toEqual([['invite_create', {}]]);
  });

  it('needs a signed-in player: no data from anyone without an account (minors before consent)', async () => {
    const res = await post(null, { events: session });
    expect(res.statusCode).toBe(401);
  });

  it('takes 1 to 50 events per batch', async () => {
    const { accessToken } = await guest();
    expect((await post(accessToken, { events: [] })).statusCode).toBe(400);
    const many = Array.from({ length: 51 }, () => ({ name: 'invite_create', props: {} }));
    expect((await post(accessToken, { events: many })).statusCode).toBe(400);
    expect((await post(accessToken, { events: many.slice(0, 50) })).json()).toEqual({
      accepted: 50,
      rejected: 0,
    });
  });
});
