import { findMatch, type BattleHandlers, type MatchSearch } from '@mathgo/battle-client';
import { api } from '../api';

/**
 * game-server's address. Expo inlines EXPO_PUBLIC_* when bundling. The default works for a phone
 * on USB after `adb reverse tcp:2567 tcp:2567` (see README).
 */
export const GAME_SERVER_URL = process.env.EXPO_PUBLIC_GAME_SERVER_URL ?? 'ws://localhost:2567';

/** Queues the signed-in player for a random battle (FR-02); `match` resolves when paired. */
export function findMatchAsPlayer(
  handlers: BattleHandlers,
  onQueued?: (trophies: number) => void,
): Promise<MatchSearch> {
  return findMatch(
    { endpoint: GAME_SERVER_URL, getToken: (force) => api.accessToken(force) },
    handlers,
    onQueued,
  );
}
