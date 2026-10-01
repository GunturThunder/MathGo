import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { Session } from './types';

/** Where the app keeps its session between launches. */
export interface TokenStore {
  get(): Session | null;
  set(session: Session): void;
  clear(): void;
}

const KEY = 'session';

/** MMKV-backed store: survives app restarts (S3-10). */
export function createTokenStore(storage: MMKV = createMMKV({ id: 'mathgo-auth' })): TokenStore {
  return {
    get() {
      const raw = storage.getString(KEY);
      if (raw === undefined) return null;
      try {
        return JSON.parse(raw) as Session;
      } catch {
        storage.remove(KEY);
        return null;
      }
    },
    set(session) {
      storage.set(KEY, JSON.stringify(session));
    },
    clear() {
      storage.remove(KEY);
    },
  };
}
