import { joinBattle, type BattleConnection, type BattleHandlers } from '@mathgo/battle-client';
import { api } from '../api';

/**
 * game-server's address. Expo inlines EXPO_PUBLIC_* when bundling. The default works for a phone
 * on USB after `adb reverse tcp:2567 tcp:2567` (see README).
 */
export const GAME_SERVER_URL = process.env.EXPO_PUBLIC_GAME_SERVER_URL ?? 'ws://localhost:2567';

/** Joins a battle as the signed-in player (a given room, or any open one). */
export function joinAsPlayer(handlers: BattleHandlers, roomId?: string): Promise<BattleConnection> {
  return joinBattle(
    { endpoint: GAME_SERVER_URL, getToken: (force) => api.accessToken(force) },
    handlers,
    roomId,
  );
}
