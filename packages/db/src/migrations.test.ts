import { PGlite } from '@electric-sql/pglite';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MIGRATIONS_FOLDER,
  events,
  matchAnswers,
  matches,
  parentalConsents,
  trophyLedger,
  users,
} from './index.js';

// A real Postgres (PGlite, compiled to WebAssembly), empty at the start.
const client = new PGlite();
const db = drizzle({ client });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
});

afterAll(async () => {
  await client.close();
});

const newUser = async (trophies = 0) => {
  const [user] = await db
    .insert(users)
    .values({ nickname: 'Harimau Cepat', birthYear: 2012, trophies })
    .returning();
  if (!user) throw new Error('no user');
  return user;
};

const match = {
  mode: 'ranked',
  arena: 1,
  levelTrophies: 0,
  seed: 4_294_967_295,
  startedAt: new Date('2026-10-20T10:00:00Z'),
  endedAt: new Date('2026-10-20T10:01:30Z'),
  outcome: 'win',
  winnerSeat: 0,
  endReason: 'ko',
  seat0Hp: 40,
  seat1Hp: 0,
} as const;

/** Postgres error code of a failed query (23505 unique, 23514 check). */
const pgCode = async (query: Promise<unknown>) => {
  try {
    await query;
    return 'ok';
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ?? (error as { code?: string }).code ?? 'unknown';
  }
};

describe('migration on an empty database', () => {
  it('creates every table', async () => {
    const result = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(result.rows.map((r) => r.table_name)).toEqual([
      'events',
      'match_answers',
      'matches',
      'parental_consents',
      'refresh_tokens',
      'trophy_ledger',
      'users',
    ]);
  });

  it('is recorded, so running it again changes nothing', async () => {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const applied = await client.query('select * from drizzle.__drizzle_migrations');
    const journal = (await import('../drizzle/meta/_journal.json', { with: { type: 'json' } }))
      .default;
    expect(applied.rows).toHaveLength(journal.entries.length);
  });
});

describe('constraints', () => {
  it('users start with 0 trophies and can never go negative', async () => {
    const user = await newUser();
    expect(user.trophies).toBe(0);
    expect(await pgCode(db.update(users).set({ trophies: -1 }).where(eq(users.id, user.id)))).toBe(
      '23514',
    );
  });

  it('a match stores a full uint32 seed and a consistent result', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const [row] = await db
      .insert(matches)
      .values({ ...match, seat0UserId: a.id, seat1UserId: b.id })
      .returning();
    expect(row?.seed).toBe(4_294_967_295);
    // A draw has no winner, and only happens at time-out.
    expect(await pgCode(db.insert(matches).values({ ...match, outcome: 'draw' }))).toBe('23514');
    expect(
      await pgCode(
        db.insert(matches).values({ ...match, outcome: 'draw', winnerSeat: null, endReason: 'ko' }),
      ),
    ).toBe('23514');
    expect(await pgCode(db.insert(matches).values({ ...match, arena: 6 }))).toBe('23514');
  });

  it('one answer per seat and question; latency is stored', async () => {
    const [m] = await db.insert(matches).values(match).returning();
    if (!m) throw new Error('no match');
    const answer = {
      matchId: m.id,
      seat: 0,
      questionIndex: 0,
      value: 7,
      correct: true,
      latencyMs: 250,
      atMs: 1_250,
      tooFast: true,
    };
    await db.insert(matchAnswers).values(answer);
    expect(await pgCode(db.insert(matchAnswers).values(answer))).toBe('23505');
    expect(
      await pgCode(db.insert(matchAnswers).values({ ...answer, questionIndex: 1, seat: 2 })),
    ).toBe('23514');
  });

  it('a match settles each player’s trophies once; reversals are separate rows', async () => {
    const user = await newUser(330);
    const [m] = await db
      .insert(matches)
      .values({ ...match, seat0UserId: user.id })
      .returning();
    if (!m) throw new Error('no match');
    const settlement = {
      userId: user.id,
      matchId: m.id,
      delta: 30,
      trophiesAfter: 330,
      reason: 'match',
    } as const;
    await db.insert(trophyLedger).values(settlement);
    expect(await pgCode(db.insert(trophyLedger).values(settlement))).toBe('23505');
    expect(
      await pgCode(
        db
          .insert(trophyLedger)
          .values({ ...settlement, delta: -30, trophiesAfter: 300, reason: 'reversal' }),
      ),
    ).toBe('ok');
  });
});

describe('deleting a user (erasure request)', () => {
  it('removes their consent and ledger, and anonymises matches, answers and events', async () => {
    const [a, b] = [await newUser(), await newUser()];
    await db.insert(parentalConsents).values({ userId: a.id, phoneHash: 'h', channel: 'whatsapp' });
    const [m] = await db
      .insert(matches)
      .values({ ...match, seat0UserId: a.id, seat1UserId: b.id })
      .returning();
    if (!m) throw new Error('no match');
    await db.insert(matchAnswers).values({
      matchId: m.id,
      seat: 0,
      userId: a.id,
      questionIndex: 0,
      value: 3,
      correct: false,
      latencyMs: 4_000,
      atMs: 4_000,
    });
    await db.insert(trophyLedger).values({
      userId: a.id,
      matchId: m.id,
      delta: 30,
      trophiesAfter: 30,
      reason: 'match',
    });
    await db.insert(events).values({ name: 'battle_end', userId: a.id, props: { arena: 1 } });

    await db.delete(users).where(eq(users.id, a.id));

    const count = async (table: string, column: string) =>
      (
        await client.query<{ n: number }>(
          `select count(*)::int as n from ${table} where ${column} = $1`,
          [a.id],
        )
      ).rows[0]?.n;
    expect(await count('parental_consents', 'user_id')).toBe(0);
    expect(await count('trophy_ledger', 'user_id')).toBe(0);
    expect(await count('match_answers', 'user_id')).toBe(0);
    expect(await count('events', 'user_id')).toBe(0);
    const [kept] = await db.select().from(matches).where(eq(matches.id, m.id));
    expect(kept).toMatchObject({ seat0UserId: null, seat1UserId: b.id });
    const [{ n } = { n: 0 }] = (
      await db.execute<{ n: number }>(
        sql`select count(*)::int as n from match_answers where match_id = ${m.id}`,
      )
    ).rows;
    expect(n).toBe(1);
  });
});
