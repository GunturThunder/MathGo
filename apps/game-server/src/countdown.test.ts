import type { Room as ClientRoom } from '@colyseus/sdk';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DEV_JWT_SECRET, signAccessToken, signingKey } from '@mathgo/auth';
import { PROTOCOL_VERSION, parseServerMessage, type ServerMessage } from '@mathgo/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { MemoryInviteStore } from './invites.js';
import { noMatchRecorder } from './match-recorder.js';
import { createServer } from './server.js';
import { openBattle, testDeps } from './test-deps.js';

// S4-10: both players see a 3-2-1 before the battle; the clock starts after it.

const COUNTDOWN_MS = 300;
let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(
    createServer(
      loadConfig({}),
      testDeps({
        invites: new MemoryInviteStore(),
        recorder: noMatchRecorder,
        countdownMs: COUNTDOWN_MS,
      }),
    ),
  );
});
afterAll(async () => {
  await colyseus.shutdown();
});

interface Inbox {
  readonly room: ClientRoom;
  readonly messages: { message: ServerMessage; at: number }[];
}

async function join(userId: string, roomId: string): Promise<Inbox> {
  const { token } = await signAccessToken(
    { userId, online: true },
    signingKey(DEV_JWT_SECRET),
    new Date(),
  );
  const room = await colyseus.sdk.joinById(roomId, { protocolVersion: PROTOCOL_VERSION, token });
  const inbox: Inbox = { room, messages: [] };
  room.onMessage('*', (type: string | number, payload: unknown) => {
    const parsed = parseServerMessage(String(type), payload);
    if (parsed.ok) inbox.messages.push({ message: parsed.message, at: performance.now() });
  });
  return inbox;
}

const first = (inbox: Inbox, type: ServerMessage['type']) =>
  inbox.messages.find((m) => m.message.type === type);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await wait(10);
}

describe('battle countdown (S4-10)', () => {
  it('both players get the countdown, then their questions when it runs out', async () => {
    const roomId = await openBattle(colyseus);
    const a = await join('count-a', roomId);
    const b = await join('count-b', roomId);
    await until(() => first(a, 'questions') !== undefined && first(b, 'questions') !== undefined);
    for (const p of [a, b]) {
      const countdown = first(p, 'countdown');
      const questions = first(p, 'questions');
      expect(countdown?.message).toEqual({
        type: 'countdown',
        payload: { startsInMs: COUNTDOWN_MS },
      });
      expect(questions).toBeDefined();
      // The questions (and the clock) come only after the countdown.
      expect(questions!.at - countdown!.at).toBeGreaterThanOrEqual(COUNTDOWN_MS - 30);
    }
    await Promise.all([a.room.leave(), b.room.leave()]);
  });

  it('answers during the countdown are ignored', async () => {
    const roomId = await openBattle(colyseus);
    const a = await join('early-a', roomId);
    const b = await join('early-b', roomId);
    await until(() => first(a, 'countdown') !== undefined);
    a.room.send('answer', { questionIndex: 0, value: 1 });
    await until(() => first(a, 'questions') !== undefined);
    await wait(50);
    expect(first(a, 'state')).toBeUndefined();
    expect(first(b, 'state')).toBeUndefined();
    await Promise.all([a.room.leave(), b.room.leave()]);
  });

  it('leaving during the countdown is a forfeit: the other player wins', async () => {
    const roomId = await openBattle(colyseus);
    const a = await join('quit-a', roomId);
    const b = await join('quit-b', roomId);
    await until(() => first(b, 'countdown') !== undefined);
    await a.room.leave();
    await until(() => first(b, 'end') !== undefined);
    const end = first(b, 'end')?.message;
    expect(end?.type === 'end' && end.payload.result).toMatchObject({
      outcome: 'win',
      reason: 'forfeit',
    });
    await b.room.leave();
  });
});
