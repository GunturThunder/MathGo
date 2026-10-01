import type { Room as ClientRoom } from '@colyseus/sdk';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { generateQuestion } from '@mathgo/game-core';
import {
  BATTLE_ROOM,
  PROTOCOL_VERSION,
  parseServerMessage,
  type ServerMessage,
} from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BattleSession } from './battle-session.js';
import { loadConfig } from './config.js';
import { MemoryInviteStore } from './invites.js';
import { noMatchRecorder } from './match-recorder.js';
import { createServer } from './server.js';
import { openBattle, testDeps } from './test-deps.js';

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    createServer(
      loadConfig({}),
      testDeps({ invites: new MemoryInviteStore(), recorder: noMatchRecorder }),
    ),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
});

/** A connected app: every message it receives, checked against the protocol. */
class TestPlayer {
  readonly inbox: ServerMessage[] = [];

  private constructor(readonly room: ClientRoom) {
    room.onMessage('*', (type: string | number, payload: unknown) => {
      const parsed = parseServerMessage(String(type), payload);
      if (!parsed.ok) throw new Error(`Invalid ${String(type)}: ${parsed.error}`);
      this.inbox.push(parsed.message);
    });
  }

  static async join(userId: string, roomId: string) {
    const { token } = await signAccessToken(
      { userId, online: true },
      signingKey(DEV_JWT_SECRET),
      new Date(),
    );
    const room = await colyseus.sdk.joinById(roomId, { protocolVersion: PROTOCOL_VERSION, token });
    return new TestPlayer(room);
  }

  async next<T extends ServerMessage['type']>(
    type: T,
    where: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    for (let i = 0; i < 200; i++) {
      const found = this.inbox.find(
        (m): m is Extract<ServerMessage, { type: T }> =>
          m.type === type && where(m as Extract<ServerMessage, { type: T }>),
      );
      if (found !== undefined) return found;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`No "${type}" message; got ${this.inbox.map((m) => m.type).join(', ')}`);
  }

  answer(questionIndex: number, value: number) {
    this.room.send('answer', { questionIndex, value });
  }
}

/** Server-side view of a room, for tests only: the seed never reaches clients. */
const serverSession = (roomId: string) =>
  (colyseus.getRoomById(roomId) as unknown as { session: BattleSession }).session;

describe('BattleRoom (S3-06)', () => {
  it('Done when: two clients get the same questions; a wrong answer is rejected', async () => {
    const roomId = await openBattle(colyseus);
    const alice = await TestPlayer.join('alice', roomId);
    const bob = await TestPlayer.join('bob', roomId);
    expect(bob.room.roomId).toBe(alice.room.roomId);

    expect((await alice.next('joined')).payload.seat).toBe(0);
    expect((await bob.next('joined')).payload.seat).toBe(1);
    const aliceQuestions = (await alice.next('questions')).payload.questions;
    const bobQuestions = (await bob.next('questions')).payload.questions;
    expect(aliceQuestions.map((q) => q.index)).toEqual([0, 1, 2]);
    expect(bobQuestions).toEqual(aliceQuestions);

    const { seed, level } = serverSession(alice.room.roomId).battle;
    const answerOf = (i: number) => generateQuestion(seed, i, level).answer;

    // Wrong: a miss and a 1 s lock for Alice, no damage to Bob, seen by both players.
    alice.answer(0, answerOf(0) + 1);
    const miss = await bob.next('state', (m) => m.payload.events.some((e) => e.type === 'miss'));
    expect(miss.payload.events).toEqual([
      { type: 'miss', seat: 0, questionIndex: 0, lockedUntil: expect.any(Number) },
    ]);
    expect(miss.payload.players[1].hp).toBe(100);

    // Right: Bob hits Alice.
    bob.answer(0, answerOf(0));
    const hit = await alice.next('state', (m) => m.payload.events.some((e) => e.type === 'hit'));
    expect(hit.payload.events[0]).toMatchObject({ type: 'hit', seat: 1, questionIndex: 0 });
    expect(hit.payload.players[0].hp).toBeLessThan(100);
    // Bob stays three questions ahead.
    expect(
      (await bob.next('questions', (m) => m.payload.questions[0]?.index === 3)).payload.questions,
    ).toHaveLength(1);

    await alice.room.leave();
    await bob.room.leave();
  });

  it('refuses a third player: the room is full', async () => {
    const roomId = await openBattle(colyseus);
    const [a, b] = [await TestPlayer.join('a', roomId), await TestPlayer.join('b', roomId)];
    await expect(TestPlayer.join('c', roomId)).rejects.toBeDefined();
    await Promise.all([a, b].map((p) => p.room.leave()));
  });

  it('clients cannot open battle rooms: random battles go through the queue (S5-02)', async () => {
    const { token } = await signAccessToken(
      { userId: 'sneaky', online: true },
      signingKey(DEV_JWT_SECRET),
      new Date(),
    );
    for (const open of [
      colyseus.sdk.joinOrCreate.bind(colyseus.sdk),
      colyseus.sdk.create.bind(colyseus.sdk),
    ]) {
      const error = await open(BATTLE_ROOM, { protocolVersion: PROTOCOL_VERSION, token }).catch(
        (e: unknown) => e,
      );
      expect(error).toMatchObject({ message: 'room-not-found' });
    }
  });

  it('rate-limits a flood of answers from one player', async () => {
    const roomId = await openBattle(colyseus);
    const spammer = await TestPlayer.join('spammer', roomId);
    const other = await TestPlayer.join('other', roomId);
    await spammer.next('questions');
    for (let i = 0; i < 12; i++) spammer.answer(99, 1); // stale question: no effect but a rejection
    expect((await spammer.next('error')).payload.code).toBe('rate-limited');
    expect(other.inbox.some((m) => m.type === 'error')).toBe(false);
    await Promise.all([spammer, other].map((p) => p.room.leave()));
  });

  it('ignores answers before the second player arrives', async () => {
    const early = await TestPlayer.join('early', await openBattle(colyseus));
    early.answer(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(early.inbox.map((m) => m.type)).toEqual(['joined']);
    await early.room.leave();
  });
});
