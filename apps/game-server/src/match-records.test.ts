import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { createInvite, joinBattle, type BattleConnection } from '@mathgo/battle-client';
import { eq, matchAnswers, matches, users } from '@mathgo/db';
import { createTestDatabase } from '@mathgo/db/testing';
import { generateQuestion } from '@mathgo/game-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BattleSession } from './battle-session.js';
import { loadConfig } from './config.js';
import { MemoryInviteStore } from './invites.js';
import { DbMatchRecorder } from './match-recorder.js';
import { createServer } from './server.js';
import { testDeps } from './test-deps.js';

const T0 = Date.parse('2026-11-23T09:00:00Z');
let fakeNow = T0;
const database = await createTestDatabase();
const { db } = database;
let colyseus: ColyseusTestServer;
const endpoint = 'ws://localhost:2568';

beforeAll(async () => {
  colyseus = await boot(
    createServer(
      loadConfig({}),
      testDeps({
        invites: new MemoryInviteStore(),
        recorder: new DbMatchRecorder(db),
        now: () => new Date(fakeNow),
      }),
    ),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
  await database.close();
});

/** A real account (match rows reference users) and a way to connect as it. */
async function account(nickname: string) {
  const [user] = await db.insert(users).values({ nickname, birthYear: 1990 }).returning();
  if (user === undefined) throw new Error('no user');
  const options = {
    endpoint,
    getToken: async () =>
      (
        await signAccessToken(
          { userId: user.id, online: true },
          signingKey(DEV_JWT_SECRET),
          new Date(fakeNow),
        )
      ).token,
  };
  return { id: user.id, options };
}

type ServerRoom = { session: BattleSession; recorded: Promise<{ matchId: string } | null> | null };
const serverRoom = (roomId: string) => colyseus.getRoomById(roomId) as unknown as ServerRoom;

async function until(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(check()).toBe(true);
}

/** Two players in one room (an invite room when `invite`), battle started at T0. */
async function startBattle(invite = false) {
  fakeNow = T0;
  const [a, b] = [await account('Harimau Cepat'), await account('Paus Hebat')];
  let roomId: string | undefined;
  if (invite) roomId = (await createInvite(a.options)).roomId;
  const ca: BattleConnection = await joinBattle(a.options, { onMessage: () => undefined }, roomId);
  const cb: BattleConnection = await joinBattle(
    b.options,
    { onMessage: () => undefined },
    ca.roomId,
  );
  const room = serverRoom(ca.roomId);
  await until(
    () => room.session.battle.players.every((p) => p.questionIndex === 0) && room.recorded === null,
  );
  const answerOf = (i: number) =>
    generateQuestion(room.session.battle.seed, i, room.session.battle.level).answer;
  /** Seat answers its current question at T0 + at (right or wrong). */
  const answer = async (conn: BattleConnection, seat: 0 | 1, at: number, right = true) => {
    const before = room.session.answers.length;
    const rejectedBefore = room.session.battle.players[seat].questionIndex;
    fakeNow = T0 + at;
    const index = room.session.battle.players[seat].questionIndex;
    conn.sendAnswer(index, right ? answerOf(index) : answerOf(index) + 1);
    await until(
      () =>
        room.session.answers.length > before ||
        room.session.battle.players[seat].questionIndex !== rejectedBefore,
    );
  };
  return { a, b, ca, cb, room, answer };
}

describe('match records (S4-03)', () => {
  it('Done when: a finished battle has one match row and one row per answer', async () => {
    const { a, b, ca, cb, room, answer } = await startBattle();
    await answer(cb, 1, 500, false); // B misses at 0.5 s (answers go in time order)
    // A KOs B: 1 s gaps → 15, 15, 15, 30 (combo), 15, 15.
    for (let i = 1; i <= 6; i++) await answer(ca, 0, i * 1_000);
    expect(room.session.battle.result).toEqual({ outcome: 'win', winner: 0, reason: 'ko' });

    const id = (await room.recorded)?.matchId;
    expect(id).toBeTruthy();
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id ?? ''));
    expect(match).toMatchObject({
      mode: 'ranked',
      arena: 1,
      seed: room.session.battle.seed,
      seat0UserId: a.id,
      seat1UserId: b.id,
      outcome: 'win',
      winnerSeat: 0,
      endReason: 'ko',
      seat0Hp: 100,
      seat1Hp: 0,
    });
    expect(match?.startedAt.getTime()).toBe(T0);
    expect(match?.endedAt.getTime()).toBe(T0 + 6_000);

    const rows = await db
      .select()
      .from(matchAnswers)
      .where(eq(matchAnswers.matchId, id ?? ''));
    expect(rows).toHaveLength(7); // 6 hits + 1 miss
    const bMiss = rows.find((r) => r.seat === 1);
    expect(bMiss).toMatchObject({
      userId: b.id,
      questionIndex: 0,
      correct: false,
      latencyMs: 500,
      atMs: 500,
    });
    const aRows = rows
      .filter((r) => r.seat === 0)
      .sort((x, y) => x.questionIndex - y.questionIndex);
    expect(aRows.map((r) => [r.questionIndex, r.correct, r.latencyMs, r.userId])).toEqual(
      [0, 1, 2, 3, 4, 5].map((q) => [q, true, 1_000, a.id]),
    );
    await Promise.all([ca.leave(), cb.leave()]);
  });

  it('answers the engine refused are not stored', async () => {
    const { ca, cb, room, answer } = await startBattle();
    await answer(ca, 0, 1_000, false); // miss: locked until 2 s
    fakeNow = T0 + 1_500;
    ca.sendAnswer(1, 0); // during the lock: refused
    await new Promise((r) => setTimeout(r, 50));
    await cb.leave(); // B quits: forfeit, A wins
    const id = (await room.recorded)?.matchId;
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id ?? ''));
    expect(match).toMatchObject({ outcome: 'win', winnerSeat: 0, endReason: 'forfeit' });
    const rows = await db
      .select()
      .from(matchAnswers)
      .where(eq(matchAnswers.matchId, id ?? ''));
    expect(rows.map((r) => [r.seat, r.questionIndex, r.correct])).toEqual([[0, 0, false]]);
    await ca.leave();
  });

  it('invite battles are stored too, as mode invite', async () => {
    const { ca, cb, room } = await startBattle(true);
    await ca.leave(); // A quits
    const id = (await room.recorded)?.matchId;
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id ?? ''));
    expect(match).toMatchObject({ mode: 'invite', winnerSeat: 1, endReason: 'forfeit' });
    await cb.leave();
  });
});
