import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { joinBattle, JoinError, type BattleConnection } from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { MemoryInviteStore } from './invites.js';
import { createServer } from './server.js';

// The app's battle client (packages/battle-client) against the real BattleRoom.
let colyseus: ColyseusTestServer;
const endpoint = 'ws://localhost:2568'; // @colyseus/testing's port
const key = signingKey(DEV_JWT_SECRET);

beforeAll(async () => {
  colyseus = await boot(createServer(loadConfig({}), new MemoryInviteStore()));
});
afterAll(async () => {
  await colyseus.shutdown();
});

const tokenFor = async (userId: string, at = new Date()) =>
  (await signAccessToken({ userId, online: true }, key, at)).token;

async function player(userId: string) {
  const inbox: ServerMessage[] = [];
  const connection = await joinBattle(
    { endpoint, getToken: () => tokenFor(userId) },
    { onMessage: (m) => inbox.push(m) },
  );
  return { inbox, connection };
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
};

describe('@mathgo/battle-client against BattleRoom (S3-11)', () => {
  it('Done when: the client joins a BattleRoom and receives questions', async () => {
    const alice = await player('alice');
    const bob = await player('bob');
    expect(bob.connection.roomId).toBe(alice.connection.roomId);

    const questionsOf = (inbox: ServerMessage[]) =>
      inbox.find((m) => m.type === 'questions')?.payload;
    await until(
      () => questionsOf(alice.inbox) !== undefined && questionsOf(bob.inbox) !== undefined,
    );
    expect(alice.inbox.find((m) => m.type === 'joined')?.payload).toMatchObject({ seat: 0 });
    expect(questionsOf(alice.inbox)?.questions).toHaveLength(3);
    expect(questionsOf(bob.inbox)).toEqual(questionsOf(alice.inbox));

    // Answers go out typed; a wrong one comes back as a miss for both players.
    alice.connection.sendAnswer(0, -12_345);
    await until(() => bob.inbox.some((m) => m.type === 'state'));

    await Promise.all([alice, bob].map((p) => p.connection.leave()));
  });

  it('turns a refused join into a JoinError with the protocol code', async () => {
    const error = await joinBattle(
      { endpoint, getToken: async () => 'garbage' },
      { onMessage: () => undefined },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(JoinError);
    expect((error as JoinError).code).toBe('invalid-token');
    expect((error as JoinError).status).toBe(401);
  });

  it('refreshes an expired token and joins on the second try', async () => {
    const calls: boolean[] = [];
    const stale = new Date(Date.now() - 20 * 60_000);
    const connection: BattleConnection = await joinBattle(
      {
        endpoint,
        getToken: async (forceRefresh) => {
          calls.push(forceRefresh);
          return tokenFor('carol', forceRefresh ? new Date() : stale);
        },
      },
      { onMessage: () => undefined },
    );
    expect(calls).toEqual([false, true]);
    await connection.leave();
  });

  it('reports an unreachable server as connection-failed', async () => {
    const error = await joinBattle(
      { endpoint: 'ws://localhost:1', getToken: () => tokenFor('dave') },
      { onMessage: () => undefined },
    ).catch((e: unknown) => e);
    expect((error as JoinError).code).toBe('connection-failed');
  });
});
