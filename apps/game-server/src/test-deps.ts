import { BATTLE_ROOM } from '@mathgo/protocol';
import { MemoryInviteStore } from './invites.js';
import { noMatchRecorder } from './match-recorder.js';
import { MemoryMatchQueue } from './matchmaking/queue-store.js';
import type { ServerDeps } from './server.js';

/** In-memory dependencies for tests; override what a test is about. */
export function testDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    invites: new MemoryInviteStore(),
    recorder: noMatchRecorder,
    matchQueue: new MemoryMatchQueue(),
    trophies: async () => 0,
    // Battles start at once in tests; countdown.test.ts covers the 3-2-1.
    countdownMs: 0,
    ...overrides,
  };
}

/**
 * Opens a battle room the way the server does (clients cannot, S5-02) and returns its id, for
 * tests that are not about matchmaking.
 */
export async function openBattle(
  colyseus: { createRoom: (name: string, options: object) => Promise<{ roomId: string }> },
  mode: 'ranked' | 'invite' = 'ranked',
): Promise<string> {
  return (await colyseus.createRoom(BATTLE_ROOM, { mode })).roomId;
}
