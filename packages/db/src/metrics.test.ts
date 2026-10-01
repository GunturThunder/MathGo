import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import {
  battlesPerDailyPlayer,
  disconnectRate,
  inviteJoinRate,
  medianQueueWait,
  parentUnlockRate,
  retention,
  successMetrics,
} from './metrics.js';
import { events, matches, users } from './schema.js';
import { createTestDatabase } from './testing.js';

const database = await createTestDatabase();
const { db } = database;
afterAll(() => database.close());
beforeEach(async () => {
  await db.delete(events);
  await db.delete(matches);
  await db.delete(users);
});

/** Noon in Jakarta (UTC+7) on a December 2026 day. */
const jakarta = (dayOfMonth: number, hour = 12) =>
  new Date(Date.UTC(2026, 11, dayOfMonth, hour - 7));
const window = { from: jakarta(1, 0), to: jakarta(29, 0) };

async function player(signedUpOn: Date) {
  const [user] = await db
    .insert(users)
    .values({ nickname: 'Rusa Lincah', birthYear: 1990, createdAt: signedUpOn })
    .returning();
  if (user === undefined) throw new Error('no user');
  return user.id;
}

async function battle(
  seats: [string | null, string | null],
  startedAt: Date,
  endReason: 'ko' | 'time' | 'forfeit' = 'ko',
) {
  await db.insert(matches).values({
    mode: 'ranked',
    arena: 1,
    levelTrophies: 0,
    seed: 1,
    seat0UserId: seats[0],
    seat1UserId: seats[1],
    startedAt,
    endedAt: new Date(startedAt.getTime() + 60_000),
    outcome: 'win',
    winnerSeat: 0,
    endReason,
    seat0Hp: 100,
    seat1Hp: 0,
  });
}

const event = (name: string, props: object, createdAt: Date, userId: string | null = null) =>
  db.insert(events).values({ name, props, createdAt, userId });

describe('success metric queries (S6-15)', () => {
  it('day-1 and day-7 retention: back on day N (a battle or any event), Jakarta days', async () => {
    const back = await player(jakarta(3));
    await battle([back, null], jakarta(4, 1)); // 01:00 Jakarta the next day, 18:00 UTC on day 3
    const eventOnly = await player(jakarta(3));
    await event('queue_wait', { waitedMs: 1, outcome: 'cancelled' }, jakarta(4), eventOnly);
    const sameDayOnly = await player(jakarta(3));
    await battle([sameDayOnly, null], jakarta(3, 23));
    const weekLater = await player(jakarta(3));
    await battle([weekLater, null], jakarta(10));
    await player(jakarta(28)); // day 1 is after the window: not in the cohort yet

    expect(await retention(db, window, 1)).toEqual({ cohort: 4, retained: 2, rate: 0.5 });
    expect(await retention(db, window, 7)).toEqual({ cohort: 4, retained: 1, rate: 0.25 });
  });

  it('battles per daily player counts each player in each battle, per Jakarta day', async () => {
    const [a, b] = [await player(jakarta(1)), await player(jakarta(1))];
    for (let i = 0; i < 6; i++) await battle([a, b], jakarta(5, 10 + i));
    await battle([a, null], jakarta(6)); // a deleted opponent counts for nobody
    await battle([a, b], jakarta(30)); // outside the window
    expect(await battlesPerDailyPlayer(db, window)).toEqual({
      battles: 13,
      playerDays: 3,
      perPlayerDay: 13 / 3,
    });
  });

  it('median queue wait over matched searches only', async () => {
    for (const ms of [4_000, 9_000, 30_000]) {
      await event('queue_wait', { waitedMs: ms, outcome: 'matched' }, jakarta(5));
    }
    await event('queue_wait', { waitedMs: 120_000, outcome: 'cancelled' }, jakarta(5));
    expect(await medianQueueWait(db, window)).toEqual({ matched: 3, medianMs: 9_000 });
    await db.delete(events);
    expect(await medianQueueWait(db, window)).toEqual({ matched: 0, medianMs: null });
  });

  it('invite join rate: joined / created; failed joins do not count', async () => {
    for (let i = 0; i < 4; i++) await event('invite_create', {}, jakarta(5));
    for (const result of ['joined', 'joined', 'joined', 'expired', 'not-found']) {
      await event('invite_join', { result }, jakarta(5));
    }
    expect(await inviteJoinRate(db, window)).toEqual({ created: 4, joined: 3, rate: 0.75 });
  });

  it('disconnect rate: forfeits / battles', async () => {
    for (let i = 0; i < 19; i++) await battle([null, null], jakarta(5), i < 9 ? 'ko' : 'time');
    await battle([null, null], jakarta(5), 'forfeit');
    expect(await disconnectRate(db, window)).toEqual({ battles: 20, forfeits: 1, rate: 0.05 });
  });

  it('parent unlock rate: verified / started consent flows', async () => {
    for (const step of ['started', 'code-sent', 'verified', 'started', 'failed', 'started']) {
      await event('consent_step', { step }, jakarta(5));
    }
    expect(await parentUnlockRate(db, window)).toEqual({ started: 3, verified: 1, rate: 1 / 3 });
  });

  it('Done when: each PRD metric has a saved query, with its target', async () => {
    const empty = await successMetrics(db, window);
    expect(empty.map((m) => m.metric)).toEqual([
      'Day-1 retention',
      'Day-7 retention',
      'Battles per daily player',
      'Median wait for a random match',
      'Invite rooms where the friend joins',
      'Battles ending in a disconnect',
      'Crash-free sessions',
      'Under-18 players whose parent unlocks online play',
    ]);
    expect(empty.every((m) => m.value === null && m.met === null)).toBe(true);

    await event('queue_wait', { waitedMs: 16_000, outcome: 'matched' }, jakarta(5));
    await battle([null, null], jakarta(5));
    const rows = await successMetrics(db, window);
    const find = (metric: string) => rows.find((m) => m.metric === metric);
    expect(find('Median wait for a random match')).toMatchObject({ value: 16, met: false });
    expect(find('Battles ending in a disconnect')).toMatchObject({ value: 0, met: true });
  });
});
