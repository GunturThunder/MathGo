import * as Haptics from 'expo-haptics';

/** A light tick on every key (S2-07). Fire and forget: a phone without a motor just skips it. */
export function keyTap(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
