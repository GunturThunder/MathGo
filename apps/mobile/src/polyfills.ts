/**
 * Runs before anything else (see index.ts).
 *
 * Hermes in React Native 0.86 has WeakRef but no FinalizationRegistry. @colyseus/schema 5 (under
 * @colyseus/sdk) creates one as soon as it loads, to tidy up server-side StateViews after garbage
 * collection; the app never creates those, so a stand-in that does nothing is safe.
 * react-native-mmkv checks for the feature itself and is fine either way.
 */
if (typeof globalThis.FinalizationRegistry === 'undefined') {
  class NoopFinalizationRegistry {
    register(): void {}
    unregister(): boolean {
      return false;
    }
  }
  globalThis.FinalizationRegistry =
    NoopFinalizationRegistry as unknown as FinalizationRegistryConstructor;
}

export {};
