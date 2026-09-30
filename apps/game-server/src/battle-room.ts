import type { AccessClaims, SigningKey } from '@mathgo/auth';
import { Room, ServerError, type AuthContext, type Client } from '@colyseus/core';
import { authorizeJoin, JoinRefused } from './join.js';

/** Two seats; S3-06 adds the seed, questions and answers (see battle-stub.ts). */
export class BattleRoom extends Room {
  private static key: SigningKey | undefined;
  private static now: () => Date = () => new Date();

  /** Called once at startup with the key that checks access tokens (JWT_SECRET). */
  static configure(key: SigningKey, now: () => Date = () => new Date()): void {
    BattleRoom.key = key;
    BattleRoom.now = now;
  }

  override maxClients = 2;

  static override async onAuth(_token: string, options: unknown, _context: AuthContext) {
    if (BattleRoom.key === undefined) {
      throw new Error('BattleRoom.configure() was not called');
    }
    try {
      return await authorizeJoin(options, BattleRoom.key, BattleRoom.now());
    } catch (error) {
      if (error instanceof JoinRefused) {
        // The client's join promise rejects with this status and the protocol error code.
        throw new ServerError(error.status, error.code);
      }
      throw error;
    }
  }

  override onJoin(client: Client, _options: unknown, auth: AccessClaims) {
    client.userData = { userId: auth.userId };
  }
}
