import { signingKey } from '@mathgo/auth';
import { createEndpoint, createRouter, defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BATTLE_ROOM, QUEUE_ROOM } from '@mathgo/protocol';
import { BattleRoom } from './battle-room.js';
import type { Config } from './config.js';
import { inviteEndpoints } from './invite-routes.js';
import type { InviteStore } from './invites.js';
import type { MatchRecorder } from './match-recorder.js';
import { Matchmaker } from './matchmaking/matchmaker.js';
import type { MatchQueueStore } from './matchmaking/queue-store.js';
import { QueueRoom, type TrophyLookup } from './queue-room.js';

export interface ServerDeps {
  readonly invites: InviteStore;
  readonly recorder: MatchRecorder;
  readonly now?: () => Date;
  /** Who waits for a random battle (Redis in services). */
  readonly matchQueue: MatchQueueStore;
  /** Players' trophies, from the database. */
  readonly trophies: TrophyLookup;
  /** Tests shorten the 15 s reconnect window. */
  readonly reconnectSeconds?: number;
  /** How often the queue is paired; 1 s by default (FR-02). */
  readonly queueTickMs?: number;
  /** The 3-2-1 before each battle; 3 s by default (S4-10). Tests set 0. */
  readonly countdownMs?: number;
}

export function createServer(config: Config, deps: ServerDeps) {
  const key = signingKey(config.JWT_SECRET);
  const now = deps.now ?? (() => new Date());
  BattleRoom.configure({ key, ...deps, now });
  QueueRoom.configure({
    key,
    matchmaker: new Matchmaker(deps.matchQueue),
    trophies: deps.trophies,
    now,
    ...(deps.queueTickMs === undefined ? {} : { tickMs: deps.queueTickMs }),
  });
  return defineServer({
    transport: new WebSocketTransport({ pingInterval: 5_000 }),
    rooms: {
      [BATTLE_ROOM]: defineRoom(BattleRoom),
      [QUEUE_ROOM]: defineRoom(QueueRoom),
    },
    routes: createRouter({
      // Liveness for Docker and the uptime monitor, like the api's.
      health: createEndpoint('/health', { method: 'GET' }, async () => ({ status: 'ok' })),
      ...inviteEndpoints(key, deps.invites, now),
    }),
  });
}
