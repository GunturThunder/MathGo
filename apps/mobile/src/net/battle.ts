import {
  createInvite,
  findInvite,
  findMatch,
  joinBattle,
  JoinError,
  type BattleClientOptions,
  type BattleConnection,
  type BattleHandlers,
  type Invite,
  type MatchSearch,
} from '@mathgo/battle-client';
import { api } from '../api';
import { OnlineLockedError, onlineLocked } from '../profile/online';
import {
  isUpdateRequiredError,
  markUpdateRequired,
  protocolVersionToSend,
  updateRequired,
} from './update-required';

/**
 * game-server's address. Expo inlines EXPO_PUBLIC_* when bundling. The default works for a phone
 * on USB after `adb reverse tcp:2567 tcp:2567` (see README).
 */
export const GAME_SERVER_URL = process.env.EXPO_PUBLIC_GAME_SERVER_URL ?? 'ws://localhost:2567';

const client = (): BattleClientOptions => ({
  endpoint: GAME_SERVER_URL,
  getToken: (force) => api.accessToken(force),
  protocolVersion: protocolVersionToSend(),
});

/**
 * Every call to game-server goes through here. It refuses before connecting while online play is
 * locked (under 18 without consent, S3-09) or this version was already refused (S4-12), and
 * remembers a refusal it gets.
 */
async function guarded<T>(call: () => Promise<T>): Promise<T> {
  if (onlineLocked()) throw new OnlineLockedError();
  // Already refused for this version: don't ask again (S4-12).
  if (updateRequired()) throw new JoinError('update-required', 426);
  try {
    return await call();
  } catch (error) {
    if (isUpdateRequiredError(error)) markUpdateRequired();
    throw error;
  }
}

/** Queues the signed-in player for a random battle (FR-02); `match` resolves when paired. */
export function findMatchAsPlayer(
  handlers: BattleHandlers,
  onQueued?: (trophies: number) => void,
): Promise<MatchSearch> {
  return guarded(() => findMatch(client(), handlers, onQueued));
}

/** A private room and its 6-character code, to share with a friend (S4-08). */
export function createInviteAsPlayer(): Promise<Invite> {
  return guarded(() => createInvite(client()));
}

/** The room behind a friend's code, without joining it yet (S4-09). */
export function findInviteAsPlayer(code: string): Promise<{ roomId: string }> {
  return guarded(() => findInvite(client(), code));
}

/** Takes a seat in a room by id: one's own invite room, or a friend's (S4-08, S4-09). */
export function joinRoomAsPlayer(
  roomId: string,
  handlers: BattleHandlers,
): Promise<BattleConnection> {
  return guarded(() => joinBattle(client(), handlers, roomId));
}
