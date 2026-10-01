import { signingKey } from '@mathgo/auth';
import { createEndpoint, createRouter, defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BATTLE_ROOM } from '@mathgo/protocol';
import { BattleRoom } from './battle-room.js';
import type { Config } from './config.js';
import { inviteEndpoints } from './invite-routes.js';
import type { InviteStore } from './invites.js';
import type { MatchRecorder } from './match-recorder.js';

export interface ServerDeps {
  readonly invites: InviteStore;
  readonly recorder: MatchRecorder;
  readonly now?: () => Date;
  /** Tests shorten the 15 s reconnect window. */
  readonly reconnectSeconds?: number;
}

export function createServer(config: Config, deps: ServerDeps) {
  const key = signingKey(config.JWT_SECRET);
  const now = deps.now ?? (() => new Date());
  BattleRoom.configure({ key, ...deps, now });
  return defineServer({
    transport: new WebSocketTransport({ pingInterval: 5_000 }),
    rooms: {
      [BATTLE_ROOM]: defineRoom(BattleRoom),
    },
    routes: createRouter({
      // Liveness for Docker and the uptime monitor, like the api's.
      health: createEndpoint('/health', { method: 'GET' }, async () => ({ status: 'ok' })),
      ...inviteEndpoints(key, deps.invites, now),
    }),
  });
}
