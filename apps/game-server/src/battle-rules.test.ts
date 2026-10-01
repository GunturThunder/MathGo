import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { joinBattle, type BattleConnection } from '@mathgo/battle-client';
import {
  applyBattleAction,
  createBattle,
  generateQuestion,
  type BattleEvent,
  type BattleState,
  type Seat,
} from '@mathgo/game-core';
import type { ServerMessage } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BattleSession } from './battle-session.js';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

/**
 * S4-01: a scripted battle through the real BattleRoom must match the game-core engine run
 * directly on the same answers and times. The room's clock is faked so times are exact.
 */
const T0 = Date.parse('2026-11-16T10:00:00Z');
let fakeNow = T0;
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(createServer(loadConfig({}), () => new Date(fakeNow)));
});
afterAll(async () => {
  await colyseus.shutdown();
});

type Step = { at: number; seat: Seat; answer: 'right' | 'wrong' | 'stale' };

interface Player {
  inbox: ServerMessage[];
  connection: BattleConnection;
}

async function join(userId: string): Promise<Player> {
  const inbox: ServerMessage[] = [];
  const key = signingKey(DEV_JWT_SECRET);
  const connection = await joinBattle(
    {
      endpoint: 'ws://localhost:2568',
      getToken: async () =>
        (await signAccessToken({ userId, online: true }, key, new Date(fakeNow))).token,
    },
    { onMessage: (m) => inbox.push(m) },
  );
  return { inbox, connection };
}

const results = (inbox: ServerMessage[]) =>
  inbox.filter((m) => m.type === 'state' || m.type === 'end');

async function waitFor(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  if (!check()) throw new Error('timed out waiting for the server');
}

/** Plays the script through the room and through the engine; returns both for comparison. */
async function play(script: Step[]) {
  fakeNow = T0;
  const players = [await join('p0'), await join('p1')] as const;
  await waitFor(() => players.every((p) => p.inbox.some((m) => m.type === 'questions')));

  const session = (
    colyseus.getRoomById(players[0].connection.roomId) as unknown as { session: BattleSession }
  ).session;
  let engine: BattleState = createBattle({
    seed: session.battle.seed,
    level: session.battle.level,
  });

  for (const step of script) {
    const player = engine.players[step.seat];
    const questionIndex = player.questionIndex + (step.answer === 'stale' ? 1 : 0);
    const answer = generateQuestion(engine.seed, questionIndex, engine.level).answer;
    const value = step.answer === 'wrong' ? answer + 1 : answer;

    const expected = applyBattleAction(engine, {
      type: 'answer',
      seat: step.seat,
      questionIndex,
      value,
      at: step.at,
    });
    engine = expected.state;

    const sender = players[step.seat];
    const before = results(sender.inbox).length;
    fakeNow = T0 + step.at;
    sender.connection.sendAnswer(questionIndex, value);
    const wantEnd = expected.events.some((e) => e.type === 'end');
    await waitFor(() => {
      const got = results(sender.inbox).slice(before);
      return got.some((m) => m.type === 'state') && (!wantEnd || got.some((m) => m.type === 'end'));
    });

    const got = results(sender.inbox).slice(before);
    const serverEvents: BattleEvent[] = got.flatMap((m) =>
      m.type === 'state' ? m.payload.events : [],
    );
    const engineEvents = expected.events.filter((e) => e.type !== 'end');
    expect({ step, events: serverEvents }).toEqual({ step, events: engineEvents });
    const end = got.find((m) => m.type === 'end');
    if (wantEnd) expect(end?.type === 'end' ? end.payload.result : null).toEqual(engine.result);
  }

  // Both players' state on the server equals the engine's, field by field.
  const last = [...results(players[0].inbox)].reverse().find((m) => m.type === 'state');
  const view = (s: Seat) => {
    const { hp, streak, comboReady, lockedUntil, questionIndex } = engine.players[s];
    return { hp, streak, comboReady, lockedUntil, questionIndex };
  };
  expect(last?.type === 'state' ? last.payload.players : null).toEqual([view(0), view(1)]);
  expect(session.battle.players).toEqual(engine.players);
  expect(session.battle.result).toEqual(engine.result);

  await Promise.all(players.map((p) => p.connection.leave()));
  return engine;
}

describe('server battle rules match the engine (S4-01)', () => {
  it('speed bonus from the server clock, combo and KO', async () => {
    const end = await play([
      { at: 1_000, seat: 0, answer: 'right' }, // 1 s after the start: 10 + 5 bonus
      { at: 5_000, seat: 1, answer: 'right' }, // 5 s: no bonus, 10
      { at: 6_000, seat: 0, answer: 'right' }, // 5 s after its last answer: 10
      { at: 7_000, seat: 0, answer: 'right' }, // 15, combo charged (3 in a row)
      { at: 8_000, seat: 0, answer: 'right' }, // combo: (10 + 5) × 2 = 30
      { at: 9_000, seat: 0, answer: 'right' }, // 15
      { at: 10_000, seat: 0, answer: 'right' }, // 15: 100 dealt, KO
      { at: 12_000, seat: 1, answer: 'right' }, // too late: finished
    ]);
    expect(end.result).toEqual({ outcome: 'win', winner: 0, reason: 'ko' });
  });

  it('wrong answer: miss, 1 s lock, rejected during the lock, bonus timed from the lock end', async () => {
    const end = await play([
      { at: 3_000, seat: 1, answer: 'wrong' },
      { at: 3_500, seat: 1, answer: 'right' }, // locked
      { at: 4_200, seat: 1, answer: 'right' }, // 0.2 s after the next question showed: +5
      { at: 4_500, seat: 0, answer: 'stale' }, // not the current question
    ]);
    expect(end.players[1]).toMatchObject({ wrong: 1, correct: 1 });
    expect(end.players[0].hp).toBe(85);
  });

  it('timer: an answer at 90 s is too late, and equal HP is a draw', async () => {
    const end = await play([
      { at: 10_000, seat: 0, answer: 'right' },
      { at: 20_000, seat: 1, answer: 'right' },
      { at: 90_000, seat: 0, answer: 'right' },
    ]);
    expect(end.result).toEqual({ outcome: 'draw', reason: 'time' });
  });
});
