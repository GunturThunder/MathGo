import { signingKey } from '@mathgo/auth';
import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BATTLE_ROOM } from '@mathgo/protocol';
import { BattleRoom } from './battle-room.js';
import type { Config } from './config.js';

export function createServer(config: Config, now?: () => Date) {
  BattleRoom.configure(signingKey(config.JWT_SECRET), now);
  return defineServer({
    transport: new WebSocketTransport({ pingInterval: 5_000 }),
    rooms: {
      [BATTLE_ROOM]: defineRoom(BattleRoom),
    },
  });
}
