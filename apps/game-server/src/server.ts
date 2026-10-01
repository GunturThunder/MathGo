import { signingKey } from '@mathgo/auth';
import { createEndpoint, createRouter, defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BATTLE_ROOM } from '@mathgo/protocol';
import { BattleRoom } from './battle-room.js';
import type { Config } from './config.js';
import { inviteEndpoints } from './invite-routes.js';
import type { InviteStore } from './invites.js';

export function createServer(
  config: Config,
  invites: InviteStore,
  now: () => Date = () => new Date(),
) {
  const key = signingKey(config.JWT_SECRET);
  BattleRoom.configure(key, invites, now);
  return defineServer({
    transport: new WebSocketTransport({ pingInterval: 5_000 }),
    rooms: {
      [BATTLE_ROOM]: defineRoom(BattleRoom),
    },
    routes: createRouter({
      // Liveness for Docker and the uptime monitor, like the api's.
      health: createEndpoint('/health', { method: 'GET' }, async () => ({ status: 'ok' })),
      ...inviteEndpoints(key, invites, now),
    }),
  });
}
