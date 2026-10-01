import { Client, type Room } from '@colyseus/sdk';
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
import { RECONNECT_SECONDS } from './battle-room.js';
import type { BattleSession } from './battle-session.js';
import { loadConfig } from './config.js';
import { MemoryInviteStore } from './invites.js';
import { noMatchRecorder } from './match-recorder.js';
import { createServer } from './server.js';

/**
 * FR-07, scaled down: a 1.5 s reconnect window stands in for the real 15 s, so a 1 s outage
 * stands in for "airplane mode for 10 s" and a 2 s one for "20 s".
 */
const WINDOW_S = 1.5;
let colyseus: ColyseusTestServer;
const endpoint = 'ws://localhost:2568';

beforeAll(async () => {
  colyseus = await boot(
    createServer(loadConfig({}), {
      invites: new MemoryInviteStore(),
      recorder: noMatchRecorder,
      reconnectSeconds: WINDOW_S,
    }),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A phone: its room, everything it received, and a way to lose the network. */
class Phone {
  readonly inbox: ServerMessage[] = [];
  private readonly client = new Client(endpoint);
  room!: Room;

  static async join(userId: string, roomId?: string) {
    const phone = new Phone();
    const { token } = await signAccessToken(
      { userId, online: true },
      signingKey(DEV_JWT_SECRET),
      new Date(),
    );
    const options = { protocolVersion: PROTOCOL_VERSION, token };
    // A fresh room per battle, so tests never share one.
    phone.attach(
      roomId === undefined
        ? await phone.client.create(BATTLE_ROOM, options)
        : await phone.client.joinById(roomId, options),
    );
    return phone;
  }

  private attach(room: Room) {
    this.room = room;
    room.reconnection.enabled = false; // the test decides how long the outage lasts
    room.onMessage('*', (type: string | number, payload: unknown) => {
      const parsed = parseServerMessage(String(type), payload);
      if (parsed.ok) this.inbox.push(parsed.message);
    });
  }

  /** Airplane mode for `ms`, then try to get back in. */
  async offlineFor(ms: number) {
    const token = this.room.reconnectionToken;
    this.room.connection.close(4010); // not CONSENTED: the server sees a drop
    await sleep(ms);
    this.attach(await this.client.reconnect(token));
  }

  messages<T extends ServerMessage['type']>(type: T) {
    return this.inbox.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }
}

async function until(check: () => boolean) {
  for (let i = 0; i < 300 && !check(); i++) await sleep(10);
  expect(check()).toBe(true);
}

async function battle() {
  const a = await Phone.join('a');
  const b = await Phone.join('b', a.room.roomId);
  await until(() => a.messages('questions').length > 0 && b.messages('questions').length > 0);
  const session = (colyseus.getRoomById(a.room.roomId) as unknown as { session: BattleSession })
    .session;
  const answerOf = (i: number) =>
    generateQuestion(session.battle.seed, i, session.battle.level).answer;
  return { a, b, session, answerOf };
}

describe('reconnect (S4-04, FR-07)', () => {
  it('the real window is 15 s', () => {
    expect(RECONNECT_SECONDS).toBe(15);
  });

  it('Done when: a short outage resumes, and the battle kept running meanwhile', async () => {
    const { a, b, session, answerOf } = await battle();

    const outage = a.offlineFor(1_000);
    // The opponent hears that A is gone, and until when the seat is held.
    await until(() => b.messages('presence').length > 0);
    expect(b.messages('presence')[0]?.payload).toMatchObject({ seat: 0, connected: false });
    expect(b.messages('presence')[0]?.payload.reconnectBy).toBeGreaterThan(0);
    // No freeze: B lands a hit while A is offline.
    b.room.send('answer', { questionIndex: 0, value: answerOf(0) });
    await until(() => session.battle.players[0].hp < 100);
    await outage;

    // A is back: B is told, and A is brought up to date (HP after the hit, next questions).
    await until(() => b.messages('presence').some((m) => m.payload.connected));
    await until(() => a.messages('state').length > 0);
    expect(a.messages('state').at(-1)?.payload.players[0].hp).toBe(session.battle.players[0].hp);
    expect(a.messages('questions').at(-1)?.payload.questions[0]?.index).toBe(0);
    // And can play on.
    a.room.send('answer', { questionIndex: 0, value: answerOf(0) });
    await until(() => session.battle.players[1].hp < 100);
    expect(session.battle.result).toBeNull();

    await Promise.all([a.room.leave(), b.room.leave()]);
  });

  it('Done when: a long outage ends the battle as a loss', async () => {
    const { a, b, session } = await battle();
    const comeback = a.offlineFor(2_000);
    await until(() => b.messages('end').length > 0);
    expect(b.messages('end')[0]?.payload.result).toEqual({
      outcome: 'win',
      winner: 1,
      reason: 'forfeit',
    });
    expect(session.battle.result).toMatchObject({ winner: 1, reason: 'forfeit' });
    await expect(comeback).rejects.toBeDefined(); // the seat is gone
    await b.room.leave();
  });

  it('quitting mid-battle is a forfeit at once', async () => {
    const { a, b } = await battle();
    await a.room.leave(true);
    await until(() => b.messages('end').length > 0);
    expect(b.messages('end')[0]?.payload.result).toEqual({
      outcome: 'win',
      winner: 1,
      reason: 'forfeit',
    });
    await b.room.leave();
  });

  it('leaving before the opponent arrives is not a forfeit', async () => {
    const a = await Phone.join('lonely');
    await a.room.leave(true);
    expect(a.messages('end')).toHaveLength(0);
  });
});
