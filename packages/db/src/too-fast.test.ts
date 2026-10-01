import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { matchAnswers, matches, users } from './schema.js';
import { createTestDatabase } from './testing.js';
import { tooFastAccounts } from './too-fast.js';

const database = await createTestDatabase();
const { db } = database;
afterAll(() => database.close());

const NOW = new Date('2026-12-14T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
const since = daysAgo(7);

async function player(nickname: string, trophies = 0) {
  const [user] = await db.insert(users).values({ nickname, birthYear: 1990, trophies }).returning();
  if (user === undefined) throw new Error('no user');
  return user.id;
}

/**
 * One ranked match on `day` (days ago) where `userId` sits in seat 0 and gives `fast` answers
 * under 300 ms (latencies 120, 121, …) and `slow` normal ones.
 */
async function played(userId: string, day: number, fast: number, slow = 0) {
  const startedAt = daysAgo(day);
  const [match] = await db
    .insert(matches)
    .values({
      mode: 'ranked',
      arena: 1,
      levelTrophies: 0,
      seed: 7,
      seat0UserId: userId,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 90_000),
      outcome: 'win',
      winnerSeat: 0,
      endReason: 'ko',
      seat0Hp: 100,
      seat1Hp: 0,
    })
    .returning();
  if (match === undefined) throw new Error('no match');
  const answers = Array.from({ length: fast + slow }, (_, i) => ({
    matchId: match.id,
    seat: 0,
    userId,
    questionIndex: i,
    value: 1,
    correct: true,
    latencyMs: i < fast ? 120 + i : 2_000,
    atMs: (i + 1) * 1_000,
    tooFast: i < fast,
  }));
  if (answers.length > 0) await db.insert(matchAnswers).values(answers);
}

describe('weekly too-fast review (S6-04)', () => {
  it('lists accounts flagged again and again, worst first, and nobody else', async () => {
    const bot = await player('Kancil Kilat', 900);
    await played(bot, 1, 8, 2);
    await played(bot, 3, 7);
    const fastHuman = await player('Kucing Gesit', 400);
    await played(fastHuman, 2, 5, 15);
    await played(fastHuman, 5, 5, 15);

    const lucky = await player('Rusa Tenang');
    await played(lucky, 1, 3, 20); // a few lucky taps
    await played(lucky, 2, 2, 20);
    const oneMatch = await player('Elang Sekali');
    await played(oneMatch, 1, 12); // all in one match: one bad battle, not a pattern
    const lastMonth = await player('Kura Lama');
    await played(lastMonth, 20, 10); // outside the window
    await played(lastMonth, 30, 10);
    await played(lastMonth, 2, 0, 10); // played this week, but cleanly

    const rows = await tooFastAccounts(db, { since });
    expect(rows.map((r) => r.nickname)).toEqual(['Kancil Kilat', 'Kucing Gesit']);
    expect(rows[0]).toEqual({
      userId: bot,
      nickname: 'Kancil Kilat',
      trophies: 900,
      answers: 17,
      tooFast: 15,
      share: 15 / 17,
      matchesWithTooFast: 2,
      fastestMs: 120,
      lastMatchAt: daysAgo(1),
    });
    expect(rows[1]).toMatchObject({ userId: fastHuman, answers: 40, tooFast: 10, share: 0.25 });
  });

  it('thresholds and the window are options', async () => {
    const all = await tooFastAccounts(db, { since: daysAgo(60), minTooFast: 5, minMatches: 1 });
    expect(all.map((r) => r.nickname)).toEqual([
      'Kura Lama',
      'Kancil Kilat',
      'Elang Sekali',
      'Kucing Gesit',
      'Rusa Tenang',
    ]);
    const lastMonth = all[0];
    expect(lastMonth).toMatchObject({ answers: 30, tooFast: 20, lastMatchAt: daysAgo(2) });
  });

  it('a deleted account drops out (its answers keep no user)', async () => {
    const gone = await player('Burung Pergi');
    await played(gone, 1, 10);
    await played(gone, 2, 10);
    expect((await tooFastAccounts(db, { since })).map((r) => r.userId)).toContain(gone);
    await db.delete(users).where(eq(users.id, gone));
    expect((await tooFastAccounts(db, { since })).map((r) => r.userId)).not.toContain(gone);
  });
});
