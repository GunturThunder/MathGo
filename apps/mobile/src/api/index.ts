import { ApiClient } from './client';
import { createTokenStore } from './token-store';

/**
 * apps/api's address. Expo inlines EXPO_PUBLIC_* when bundling. The default works for a phone
 * on USB after `adb reverse tcp:3000 tcp:3000` (see README).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = new ApiClient({ baseUrl: API_URL, store: createTokenStore() });

export { ApiClient, ApiError, SessionEndedError } from './client';
export type { ConsentStarted, Profile, Session } from './types';
