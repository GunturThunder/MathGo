import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
import { profile } from '../profile/store';

// Reduce Motion (GF-01; WCAG 2.3.3). On when the phone's setting is on, or when the player turns
// it on in Settings. Effects then drop shake, hit-stop, flights and idle loops, and entrances
// become short fades; damage numbers, colours and haptics stay.

let system = false;
let started = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Starts following the phone's setting, live. Safe to call more than once. */
function follow(): void {
  if (started) return;
  started = true;
  void AccessibilityInfo.isReduceMotionEnabled()
    .then((on) => {
      if (on !== system) {
        system = on;
        notify();
      }
    })
    .catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
    system = on;
    notify();
  });
}

export const reduceMotion = {
  /** The phone's setting or the in-app switch. */
  isOn: (): boolean => system || profile.get().reduceMotion,
  /** The phone's setting alone (Settings shows the switch as on and locked). */
  isOnInSystem: (): boolean => system,
  setInApp(on: boolean): void {
    profile.setReduceMotion(on);
    notify();
  },
  subscribe(listener: () => void): () => void {
    follow();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Tests: pretend the phone's setting changed. */
  setSystemForTest(on: boolean): void {
    system = on;
    notify();
  },
};

/** True while effects should be calm (GF-01). Re-renders when either setting changes. */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(reduceMotion.subscribe, reduceMotion.isOn, reduceMotion.isOn);
}

/** The phone's setting alone, for the Settings switch. */
export function useReduceMotionInSystem(): boolean {
  return useSyncExternalStore(
    reduceMotion.subscribe,
    reduceMotion.isOnInSystem,
    reduceMotion.isOnInSystem,
  );
}
