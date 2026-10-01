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
    ...overrides,
  };
}
