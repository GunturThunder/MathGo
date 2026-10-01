import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { joinBattle } from '@mathgo/battle-client';
import { eq, matchAnswers, users } from '@mathgo/db';
import { createTestDatabase } from '@mathgo/db/testing';
import { generateQuestion } from '@mathgo/game-core';
import type { ServerMessage } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ANSWER_RATE_LIMIT } from './battle-room.js';
import { TOO_FAST_MS, type BattleSession } from './battle-session.js';
import { loadConfig } from './config.js';
import { MemoryInviteStore } from './invites.js';
import { DbMatchRecorder } from './match-recorder.js';
import { createServer } from './server.js';
import { testDeps } from './test-deps.js';

const T0 = Date.parse('2026-11-25T09:00:00Z');
let fakeNow = T0;
const database = await createTestDatabase();
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    createServer(
      loadConfig({}),
      testDeps({
        invites: new MemoryInviteStore(),
        recorder: new DbMatchRecorder(database.db),
        now: () => new Date(fakeNow),
      }),
    ),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
  await database.close();
});

async function player(nickname: string, roomId?: string) {
  const [user] = await database.db.insert(users).values({ nickname, birthYear: 1990 }).returning();
  if (user === undefined) throw new Error('no user');
  const inbox: ServerMessage[] = [];
  const connection = await joinBattle(
    {
      endpoint: 'ws://localhost:2568',
      getToken: async () =>
        (
          await signAccessToken(
            { userId: user.id, online: true },
            signingKey(DEV_JWT_SECRET),
            new Date(fakeNow),
          )
        ).token,
    },
    { onMessage: (m) => inbox.push(m) },
    roomId,
  );
  return { id: user.id, inbox, connection };
}

async function until(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(check()).toBe(true);
}

describe('anti-cheat basics (S4-06)', () => {
  it('limits are what the PRD asks for', () => {
    expect(TOO_FAST_MS).toBe(300);
    expect(ANSWER_RATE_LIMIT).toEqual({ max: 5, windowMs: 1_000 });
  });

  it('Done when: scripted fast answers are rate-limited and flagged', async () => {
    fakeNow = T0;
    const bot = await player('Rubah Cerdas');
    const human = await player('Kucing Tenang', bot.connection.roomId);
    const room = colyseus.getRoomById(bot.connection.roomId) as unknown as {
      session: BattleSession;
      recorded: Promise<string> | null;
    };
    await until(() => bot.inbox.some((m) => m.type === 'questions'));
    const { seed, level } = room.session.battle;
    const answerOf = (i: number) => generateQuestion(seed, i, level).answer;
    const counted = () => room.session.answers.length;

    // A script answers each question 100 ms after it shows: 5 within one second.
    for (let q = 0; q < 5; q++) {
      fakeNow = T0 + (q + 1) * 100;
      const before = counted();
      bot.connection.sendAnswer(q, answerOf(q));
      await until(() => counted() > before);
    }
    // A sixth in the same second is dropped: rate-limited, not counted, not stored.
    fakeNow = T0 + 600;
    bot.connection.sendAnswer(5, answerOf(5));
    await until(() =>
      bot.inbox.some((m) => m.type === 'error' && m.payload.code === 'rate-limited'),
    );
    expect(counted()).toBe(5);
    expect(human.inbox.some((m) => m.type === 'error')).toBe(false);

    // Later, at human speed (1.2 s after the question showed): counted, not flagged. It is also
    // the knockout (15 × 3 + 30 + 15 = 90 so far), which ends the battle and stores it.
    fakeNow = T0 + 1_700;
    bot.connection.sendAnswer(5, answerOf(5));
    await until(() => room.recorded !== null);
    const matchId = await room.recorded;

    const rows = await database.db
      .select()
      .from(matchAnswers)
      .where(eq(matchAnswers.matchId, matchId ?? ''));
    const flags = rows
      .sort((a, b) => a.questionIndex - b.questionIndex)
      .map((r) => [r.questionIndex, r.latencyMs, r.tooFast]);
    expect(flags).toEqual([
      [0, 100, true],
      [1, 100, true],
      [2, 100, true],
      [3, 100, true],
      [4, 100, true],
      [5, 1_200, false],
    ]);
    // What the weekly review (S6-04) will count for this account.
    const flagged = rows.filter((r) => r.userId === bot.id && r.tooFast);
    expect(flagged).toHaveLength(5);

    await Promise.all([bot.connection.leave(), human.connection.leave()]);
  });
});
