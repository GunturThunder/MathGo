import { findMatch, type BattleHandlers, type MatchSearch } from '@mathgo/battle-client';
import { api } from '../api';
import { OnlineLockedError, onlineLocked } from '../profile/online';

/**
 * game-server's address. Expo inlines EXPO_PUBLIC_* when bundling. The default works for a phone
 * on USB after `adb reverse tcp:2567 tcp:2567` (see README).
 */
export const GAME_SERVER_URL = process.env.EXPO_PUBLIC_GAME_SERVER_URL ?? 'ws://localhost:2567';

/**
 * Queues the signed-in player for a random battle (FR-02); `match` resolves when paired.
 * Refuses before connecting while online play is locked (under 18 without consent, S3-09).
 */
export function findMatchAsPlayer(
  handlers: BattleHandlers,
  onQueued?: (trophies: number) => void,
): Promise<MatchSearch> {
  if (onlineLocked()) return Promise.reject(new OnlineLockedError());
  return findMatch(
    { endpoint: GAME_SERVER_URL, getToken: (force) => api.accessToken(force) },
    handlers,
    onQueued,
  );
}
