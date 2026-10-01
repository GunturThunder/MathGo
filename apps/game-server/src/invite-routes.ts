import { AuthError, requireOnlinePlay, verifyAccessToken, type SigningKey } from '@mathgo/auth';
import { createEndpoint, matchMaker } from '@colyseus/core';
import { BATTLE_ROOM } from '@mathgo/protocol';
import { normalizeInviteCode, type InviteStore } from './invites.js';

const AUTH_STATUS = {
  'invalid-token': 401,
  'token-expired': 401,
  'consent-required': 403,
} as const;

/**
 * POST /invites creates a private battle room and its 6-character code (S4-08 shares it);
 * GET /invites/:code finds the room to join by id (S4-09). Errors carry protocol codes.
 */
export function inviteEndpoints(key: SigningKey, invites: InviteStore, now: () => Date) {
  const createInvite = createEndpoint('/invites', { method: 'POST' }, async (ctx) => {
    const match = /^Bearer (\S+)$/.exec(ctx.getHeader('authorization') ?? '');
    try {
      const claims = await verifyAccessToken(match?.[1] ?? '', key, now());
      requireOnlinePlay(claims);
    } catch (error) {
      if (error instanceof AuthError) {
        throw ctx.error(AUTH_STATUS[error.code], { code: error.code, message: error.message });
      }
      throw error;
    }
    const room = await matchMaker.createRoom(BATTLE_ROOM, { mode: 'invite' });
    const { code, expiresAt } = await invites.create(room.roomId);
    return { code, roomId: room.roomId, expiresAt: expiresAt.toISOString() };
  });

  const findInvite = createEndpoint('/invites/:code', { method: 'GET' }, async (ctx) => {
    const code = normalizeInviteCode(ctx.params.code);
    const found = code === null ? ({ status: 'not-found' } as const) : await invites.resolve(code);
    if (found.status === 'expired') {
      throw ctx.error(410, { code: 'room-expired', message: 'This code has expired.' });
    }
    if (found.status === 'not-found') {
      throw ctx.error(404, { code: 'room-not-found', message: 'No room has this code.' });
    }
    return { roomId: found.roomId };
  });

  return { createInvite, findInvite };
}
