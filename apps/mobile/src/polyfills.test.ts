/* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules loads fresh modules with require() */

describe('polyfills for Hermes', () => {
  const original = globalThis.FinalizationRegistry;
  afterEach(() => {
    globalThis.FinalizationRegistry = original;
  });

  it('the Colyseus client loads in an engine without FinalizationRegistry (like Hermes)', () => {
    // @ts-expect-error -- simulating Hermes, which does not have it
    delete globalThis.FinalizationRegistry;
    jest.isolateModules(() => {
      expect(() => require('@colyseus/schema')).toThrow(/FinalizationRegistry/);
    });
    jest.isolateModules(() => {
      require('./polyfills');
      expect(() => require('@mathgo/battle-client')).not.toThrow();
      const registry = new FinalizationRegistry(() => undefined);
      expect(() => registry.register({}, 'held')).not.toThrow();
    });
  });

  it('keeps a real FinalizationRegistry when the engine has one', () => {
    jest.isolateModules(() => {
      require('./polyfills');
    });
    expect(globalThis.FinalizationRegistry).toBe(original);
  });
});
