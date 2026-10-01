import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { findMatch } from '@mathgo/battle-client';
import { eq, sql, trophyLedger, users } from '@mathgo/db';
import { createTestDatabase } from '@mathgo/db/testing';
import {
  applyBattleAction,
  createBattle,
  createRng,
  generateQuestion,
  type BattleState,
  type Seat,
} from '@mathgo/game-core';
import type { ServerMessage } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BattleSession } from './battle-session.js';
import { loadConfig } from './config.js';
import { DbMatchRecorder, type FinishedMatch } from './match-recorder.js';
import { MemoryMatchQueue } from './matchmaking/queue-store.js';
import { dbTrophyLookup } from './queue-room.js';
import { createServer } from './server.js';
import { testDeps } from './test-deps.js';

const database = await createTestDatabase();
const { db } = database;
const recorder = new DbMatchRecorder(db);
afterAll(() => database.close());

async function player(trophies = 0) {
  const [user] = await db
    .insert(users)
    .values({ nickname: 'Rusa Lincah', birthYear: 1990, trophies })
    .returning();
  if (user === undefined) throw new Error('no user');
  return user.id;
}

/** A finished battle without playing it: a forfeit, a time-out draw, or a time-out win. */
function finished(kind: 'forfeit-0' | 'forfeit-1' | 'draw' | 'win-0'): BattleState {
  let state = createBattle({ seed: 7, level: { arena: 1, trophies: 0 } });
  if (kind === 'forfeit-0' || kind === 'forfeit-1') {
    return applyBattleAction(state, {
      type: 'forfeit',
      seat: kind === 'forfeit-0' ? 0 : 1,
      at: 5_000,
    }).state;
  }
  if (kind === 'win-0') {
    const answer = generateQuestion(7, 0, state.level).answer;
    state = applyBattleAction(state, {
      type: 'answer',
      seat: 0,
      questionIndex: 0,
      value: answer,
      at: 5_000,
    }).state;
  }
  return applyBattleAction(state, { type: 'tick', at: 90_000 }).state;
}

const match = (
  seats: [string, string],
  battle: BattleState,
  mode: 'ranked' | 'invite' = 'ranked',
): FinishedMatch => ({
  mode,
  battle,
  users: seats,
  startedAt: new Date('2026-12-02T10:00:00Z'),
  endedAt: new Date('2026-12-02T10:01:30Z'),
  answers: [],
});

const trophiesOf = async (id: string) =>
  (await db.select().from(users).where(eq(users.id, id)))[0]?.trophies;
const ledgerOf = (id: string) => db.select().from(trophyLedger).where(eq(trophyLedger.userId, id));

describe('trophy settlement (S5-03)', () => {
  it('a ranked win: +30 / −20 between equals, in users and in the ledger', async () => {
    const [a, b] = [await player(500), await player(500)];
    const { matchId, trophies } = await recorder.record(match([a, b], finished('win-0')));
    expect(trophies?.map((t) => t.delta)).toEqual([30, -20]);
    expect([await trophiesOf(a), await trophiesOf(b)]).toEqual([530, 480]);
    expect((await ledgerOf(a))[0]).toMatchObject({
      matchId,
      delta: 30,
      trophiesAfter: 530,
      reason: 'match',
    });
  });

  it('a loss at an arena floor costs nothing, and is still in the ledger', async () => {
    const [a, b] = [await player(300), await player(300)];
    await recorder.record(match([a, b], finished('forfeit-0'))); // a forfeits at Plus Plains' floor
    expect([await trophiesOf(a), await trophiesOf(b)]).toEqual([300, 330]);
    expect((await ledgerOf(a)).map((r) => r.delta)).toEqual([0]);
  });

  it('a draw changes nothing', async () => {
    const [a, b] = [await player(700), await player(900)];
    const { trophies } = await recorder.record(match([a, b], finished('draw')));
    expect(trophies?.map((t) => t.delta)).toEqual([0, 0]);
    expect([await trophiesOf(a), await trophiesOf(b)]).toEqual([700, 900]);
  });

  it('Done when: invite battles change nothing', async () => {
    const [a, b] = [await player(500), await player(500)];
    const { trophies } = await recorder.record(match([a, b], finished('win-0'), 'invite'));
    expect(trophies).toBeNull();
    expect([await trophiesOf(a), await trophiesOf(b)]).toEqual([500, 500]);
    expect([...(await ledgerOf(a)), ...(await ledgerOf(b))]).toEqual([]);
  });

  it("Done when: the ledger sum equals each user's trophies, after 60 ranked battles", async () => {
    const ids = await Promise.all(Array.from({ length: 6 }, () => player(0)));
    const rng = createRng(2026, 5);
    const kinds = ['forfeit-0', 'forfeit-1', 'draw', 'win-0'] as const;
    for (let round = 0; round < 10; round++) {
      // Six battles at once per round: settlements for the same player run concurrently.
      await Promise.all(
        Array.from({ length: 6 }, () => {
          const a = rng.int(0, 5);
          const b = (a + rng.int(1, 5)) % 6;
          return recorder.record(match([ids[a] ?? '', ids[b] ?? ''], finished(rng.pick(kinds))));
        }),
      );
    }
    for (const id of ids) {
      const [{ sum } = { sum: 0 }] = await db
        .select({ sum: sql<number>`coalesce(sum(${trophyLedger.delta}), 0)::int` })
        .from(trophyLedger)
        .where(eq(trophyLedger.userId, id));
      const trophies = await trophiesOf(id);
      expect({ id, sum }).toEqual({ id, sum: trophies });
      const rows = await ledgerOf(id);
      const last = rows.sort((x, y) => x.id - y.id).at(-1);
      if (last !== undefined) expect(last.trophiesAfter).toBe(trophies);
    }
  });
});

describe('settlement through a matched battle', () => {
  let colyseus: ColyseusTestServer;
  let fakeNow = Date.parse('2026-12-02T12:00:00Z');
  beforeAll(async () => {
    colyseus = await boot(
      createServer(
        loadConfig({}),
        testDeps({
          recorder,
          matchQueue: new MemoryMatchQueue(),
          trophies: dbTrophyLookup(db),
          now: () => new Date(fakeNow),
          queueTickMs: 50,
        }),
      ),
    );
  });
  afterAll(() => colyseus.shutdown());

  it('the end message carries both trophy changes, as stored', async () => {
    const ids = [await player(500), await player(520)] as const;
    const as = (id: string) => ({
      endpoint: 'ws://localhost:2568',
      getToken: async () =>
        (
          await signAccessToken(
            { userId: id, online: true },
            signingKey(DEV_JWT_SECRET),
            new Date(fakeNow),
          )
        ).token,
    });
    const inboxes: ServerMessage[][] = [[], []];
    const searches = await Promise.all(
      ids.map((id, i) => findMatch(as(id), { onMessage: (m) => inboxes[i]?.push(m) })),
    );
    const connections = await Promise.all(searches.map((s) => s.match));
    const room = colyseus.getRoomById(connections[0]?.roomId ?? '') as unknown as {
      session: BattleSession;
    };
    const seatOf = (i: number) =>
      inboxes[i]?.find((m) => m.type === 'joined')?.payload.seat as Seat | undefined;
    for (let i = 0; i < 300 && (seatOf(0) === undefined || seatOf(1) === undefined); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    // Whoever sits in seat 0 knocks the other out.
    const winner = seatOf(0) === 0 ? 0 : 1;
    for (let q = 0; q < 6; q++) {
      fakeNow += 1_000;
      const before = room.session.answers.length;
      connections[winner]?.sendAnswer(
        q,
        generateQuestion(room.session.battle.seed, q, room.session.battle.level).answer,
      );
      for (let i = 0; i < 300 && room.session.answers.length === before; i++)
        await new Promise((r) => setTimeout(r, 5));
    }
    for (let i = 0; i < 300 && !inboxes.every((box) => box.some((m) => m.type === 'end')); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const end = inboxes[0]?.find((m) => m.type === 'end');
    expect(end?.type).toBe('end');
    if (end?.type !== 'end') return;
    const seatIds = [winner === 0 ? ids[0] : ids[1], winner === 0 ? ids[1] : ids[0]];
    expect(end.payload.trophies?.map((t) => t.trophies)).toEqual([
      await trophiesOf(seatIds[0] ?? ''),
      await trophiesOf(seatIds[1] ?? ''),
    ]);
    expect(end.payload.trophies?.[0]?.delta).toBeGreaterThan(0);
    await Promise.all(connections.map((c) => c.leave()));
  });
});
