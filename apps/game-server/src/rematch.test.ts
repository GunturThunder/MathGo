import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import {
  createInvite,
  joinBattle,
  joinByCode,
  type BattleConnection,
  type BattleClientOptions,
} from '@mathgo/battle-client';
import { generateQuestion } from '@mathgo/game-core';
import type { ServerMessage } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BattleSession } from './battle-session.js';
import { loadConfig } from './config.js';
import { MemoryInviteStore } from './invites.js';
import type { FinishedMatch, MatchRecorder } from './match-recorder.js';
import { createServer } from './server.js';
import { openBattle, testDeps } from './test-deps.js';

let fakeNow = Date.parse('2026-11-26T09:00:00Z');
const stored: FinishedMatch[] = [];
const recorder: MatchRecorder = {
  record: async (match) => {
    stored.push(match);
    return { matchId: `match-${stored.length}`, trophies: null };
  },
};
const invites = new MemoryInviteStore();
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    createServer(loadConfig({}), testDeps({ invites, recorder, now: () => new Date(fakeNow) })),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
});

const as = (userId: string): BattleClientOptions => ({
  endpoint: 'ws://localhost:2568',
  getToken: async () =>
    (await signAccessToken({ userId, online: true }, signingKey(DEV_JWT_SECRET), new Date(fakeNow)))
      .token,
});

async function until(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
  expect(check()).toBe(true);
}

interface Player {
  inbox: ServerMessage[];
  conn: BattleConnection;
}
const count = (p: Player, type: ServerMessage['type']) =>
  p.inbox.filter((m) => m.type === type).length;
const session = (roomId: string) =>
  (colyseus.getRoomById(roomId) as unknown as { session: BattleSession }).session;

/** Host knocks the friend out with six fast answers (15, 15, 15, 30, 15, 15). */
async function knockOut(host: Player, roomId: string) {
  const battle = session(roomId);
  for (let q = 0; q < 6; q++) {
    fakeNow += 1_000;
    const before = battle.answers.length;
    host.conn.sendAnswer(q, generateQuestion(battle.battle.seed, q, battle.battle.level).answer);
    await until(() => battle.answers.length > before);
  }
  expect(battle.battle.result).toMatchObject({ winner: 0, reason: 'ko' });
}

async function inviteBattle() {
  const host: Player = { inbox: [], conn: undefined as unknown as BattleConnection };
  const friend: Player = { inbox: [], conn: undefined as unknown as BattleConnection };
  const invite = await createInvite(as('host'));
  host.conn = await joinBattle(as('host'), { onMessage: (m) => host.inbox.push(m) }, invite.roomId);
  friend.conn = await joinByCode(
    as('friend'),
    { onMessage: (m) => friend.inbox.push(m) },
    invite.code,
  );
  await until(() => count(host, 'questions') > 0 && count(friend, 'questions') > 0);
  return { host, friend, invite };
}

describe('rematch in an invite room (S4-05)', () => {
  it('Done when: two rematches in a row work without a new code', async () => {
    const { host, friend, invite } = await inviteBattle();
    const seeds = [session(invite.roomId).battle.seed];

    for (let round = 1; round <= 2; round++) {
      await knockOut(host, invite.roomId);
      const joinedBefore = count(friend, 'joined');

      host.conn.requestRematch(true);
      // The friend sees the offer before answering it.
      await until(() => friend.inbox.some((m) => m.type === 'rematch' && m.payload.seat === 0));
      friend.conn.requestRematch(true);

      // A new battle in the same room: joined again, fresh questions from 0, full HP.
      await until(() => count(friend, 'joined') > joinedBefore);
      const battle = session(invite.roomId);
      expect(battle.battle.result).toBeNull();
      expect(battle.battle.players.map((p) => p.hp)).toEqual([100, 100]);
      expect(friend.inbox.at(-1)).toMatchObject({ type: 'questions' });
      seeds.push(battle.battle.seed);
    }

    // Still the same room and the same code, which still resolves.
    expect(await invites.resolve(invite.code)).toEqual({ status: 'ok', roomId: invite.roomId });
    await knockOut(host, invite.roomId);
    await until(() => stored.length >= 3);
    expect(stored.slice(-3).map((m) => [m.mode, m.battle.result?.reason])).toEqual([
      ['invite', 'ko'],
      ['invite', 'ko'],
      ['invite', 'ko'],
    ]);
    // Each battle has its own secret seed.
    expect(new Set(seeds).size).toBe(3);

    await Promise.all([host.conn.leave(), friend.conn.leave()]);
  });

  it('starts only when both accept; a decline is shown to the other player', async () => {
    const { host, friend, invite } = await inviteBattle();
    await knockOut(host, invite.roomId);
    host.conn.requestRematch(true);
    friend.conn.requestRematch(false);
    await until(() => host.inbox.some((m) => m.type === 'rematch' && m.payload.seat === 1));
    expect(host.inbox.filter((m) => m.type === 'rematch').map((m) => m.payload)).toEqual([
      { seat: 0, accepted: true },
      { seat: 1, accepted: false },
    ]);
    expect(session(invite.roomId).battle.result).not.toBeNull(); // no new battle
    await Promise.all([host.conn.leave(), friend.conn.leave()]);
  });

  it('is refused mid-battle and in random battles', async () => {
    const { host, friend } = await inviteBattle();
    host.conn.requestRematch(true); // the battle is still running
    await until(() => host.inbox.some((m) => m.type === 'error'));
    await Promise.all([host.conn.leave(), friend.conn.leave()]);

    const inbox: ServerMessage[] = [];
    const ranked = await openBattle(colyseus);
    const a = await joinBattle(as('a'), { onMessage: (m) => inbox.push(m) }, ranked);
    const b = await joinBattle(as('b'), { onMessage: () => undefined }, ranked);
    await b.leave(); // forfeit: the ranked battle ends
    a.requestRematch(true);
    await until(() => inbox.some((m) => m.type === 'error'));
    await a.leave();
  });
});
