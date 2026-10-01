import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import {
  createInvite,
  findMatch,
  joinBattle,
  joinByCode,
  type BattleClientOptions,
} from '@mathgo/battle-client';
import { generateQuestion } from '@mathgo/game-core';
import type { ServerMessage } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BattleSession } from './battle-session.js';
import { loadConfig } from './config.js';
import { MemoryMatchQueue } from './matchmaking/queue-store.js';
import { createServer } from './server.js';
import { testDeps } from './test-deps.js';

const trophies = new Map<string, number>();
let colyseus: ColyseusTestServer;
let fakeNow = Date.parse('2026-12-04T09:00:00Z');

beforeAll(async () => {
  colyseus = await boot(
    createServer(
      loadConfig({}),
      testDeps({
        matchQueue: new MemoryMatchQueue(),
        trophies: async (id) => trophies.get(id) ?? null,
        now: () => new Date(fakeNow),
        queueTickMs: 50,
      }),
    ),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
});

const as = (userId: string, cups: number): BattleClientOptions => {
  trophies.set(userId, cups);
  return {
    endpoint: 'ws://localhost:2568',
    getToken: async () =>
      (
        await signAccessToken(
          { userId, online: true },
          signingKey(DEV_JWT_SECRET),
          new Date(fakeNow),
        )
      ).token,
  };
};
const session = (roomId: string) =>
  (colyseus.getRoomById(roomId) as unknown as { session: BattleSession }).session;

async function until(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
}

/** Two players through the random queue; long waits let far-apart trophies meet. */
async function queueMatch(a: [string, number], b: [string, number]) {
  const inbox: ServerMessage[] = [];
  const sa = await findMatch(as(...a), { onMessage: (m) => inbox.push(m) });
  const sb = await findMatch(as(...b), { onMessage: () => undefined });
  fakeNow += 120_000; // window 100 + 24 × 50: wide enough for any gap here
  const [ca, cb] = await Promise.all([sa.match, sb.match]);
  await until(() => inbox.some((m) => m.type === 'questions'));
  return { inbox, ca, cb };
}

describe('arena per match (S5-04)', () => {
  it('Done when: a 250 vs 800 trophy match gets arena 1 questions', async () => {
    const { inbox, ca, cb } = await queueMatch(['low', 250], ['high', 800]);
    const { battle } = session(ca.roomId);
    expect(battle.level).toEqual({ arena: 1, trophies: 250 });
    expect(inbox.find((m) => m.type === 'joined')?.payload).toMatchObject({ arena: 1 });
    // The questions the players get are arena 1's, at 250 trophies.
    const sent = inbox.find((m) => m.type === 'questions');
    const first = sent?.type === 'questions' ? sent.payload.questions[0]?.text : undefined;
    expect(first).toBe(generateQuestion(battle.seed, 0, { arena: 1, trophies: 250 }).text);
    await Promise.all([ca.leave(), cb.leave()]);
  });

  it('higher up, the lower player still sets arena and difficulty', async () => {
    const { ca, cb } = await queueMatch(['mixed', 1_300], ['peak', 2_000]);
    expect(session(ca.roomId).battle.level).toEqual({ arena: 4, trophies: 1_300 });
    await Promise.all([ca.leave(), cb.leave()]);
  });

  it('invite battles too: friends in different arenas play the lower one, rematches keep it', async () => {
    const inbox: ServerMessage[] = [];
    const invite = await createInvite(as('tower', 750));
    const host = await joinBattle(
      as('tower', 750),
      { onMessage: (m) => inbox.push(m) },
      invite.roomId,
    );
    const friend = await joinByCode(
      as('summit', 1_900),
      { onMessage: () => undefined },
      invite.code,
    );
    await until(() => inbox.some((m) => m.type === 'questions'));
    expect(session(invite.roomId).battle.level).toEqual({ arena: 3, trophies: 750 });
    expect(inbox.find((m) => m.type === 'joined')?.payload).toMatchObject({ arena: 3 });

    // The host knocks the friend out (six fast right answers), then both accept a rematch.
    const room = session(invite.roomId);
    const hostSeat = inbox.find((m) => m.type === 'joined')?.payload.seat ?? 0;
    for (let q = 0; q < 6; q++) {
      fakeNow += 1_000;
      const before = room.answers.length;
      host.sendAnswer(q, generateQuestion(room.battle.seed, q, room.battle.level).answer);
      await until(() => room.answers.length > before);
    }
    expect(room.battle.result).toMatchObject({ winner: hostSeat, reason: 'ko' });
    host.requestRematch(true);
    friend.requestRematch(true);
    await until(() => inbox.filter((m) => m.type === 'joined').length >= 2);
    expect(session(invite.roomId).battle.result).toBeNull(); // a new battle
    expect(session(invite.roomId).battle.level).toEqual({ arena: 3, trophies: 750 });
    await Promise.all([host.leave(), friend.leave()]);
  });
});
