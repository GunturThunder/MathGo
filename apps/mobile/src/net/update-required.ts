import { JoinError } from '@mathgo/battle-client';
import { PROTOCOL_VERSION } from '@mathgo/protocol';
import { createMMKV, type MMKV } from 'react-native-mmkv';

// "Update required" (S4-12): once game-server refuses this build's protocol version, the app
// remembers it and sends online play to the update screen, without asking again. The flag is
// tied to the protocol version, so it clears itself when the updated app arrives.

const KEY = 'refusedProtocolVersion';
let storage: MMKV | null = null;
const store = () => (storage ??= createMMKV({ id: 'mathgo-app' }));

/** Dev builds: send an old protocol version to check the update screen against a real server. */
let pretendOld = false;

export function updateRequired(): boolean {
  return store().getNumber(KEY) === PROTOCOL_VERSION;
}

export function markUpdateRequired(): void {
  store().set(KEY, PROTOCOL_VERSION);
}

export function isUpdateRequiredError(error: unknown): boolean {
  return error instanceof JoinError && error.code === 'update-required';
}

/** The protocol version to send: this build's, or an old one while the dev switch is on. */
export function protocolVersionToSend(): number {
  return pretendOld ? PROTOCOL_VERSION - 1 : PROTOCOL_VERSION;
}

export function devPretendOldVersion(): boolean {
  return pretendOld;
}

/** Dev switch. Turning it off also forgets the refusal, so online play works again. */
export function setDevPretendOldVersion(on: boolean): void {
  pretendOld = on;
  if (!on) store().remove(KEY);
}
