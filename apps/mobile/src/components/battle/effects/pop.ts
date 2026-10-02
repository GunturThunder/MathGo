import { useEffect } from 'react';
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// The design's "mbPop": in from 40 % with a twist, overshoot to 112 %, settle. Runs on the UI
// thread; `trigger` changing restarts it (0 = stay hidden until the first trigger).

export const POP_MS = 350;

export function usePop(trigger: number, durationMs = POP_MS) {
  const progress = useSharedValue(trigger === 0 ? 0 : 1);
  useEffect(() => {
    if (trigger === 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: durationMs, easing: Easing.out(Easing.quad) });
  }, [trigger, durationMs, progress]);
  return useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 1, 1]),
    transform: [
      { scale: interpolate(progress.value, [0, 0.6, 1], [0.4, 1.12, 1]) },
      { rotate: `${interpolate(progress.value, [0, 0.6, 1], [-18, 4, 0])}deg` },
    ],
  }));
}

/** A short horizontal shake (wrong answer), restarted when `trigger` changes. */
export function useShake(trigger: number, distance = 8) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (trigger === 0) return;
    const step = (to: number) => withTiming(to, { duration: 50 });
    x.value = withSequence(
      step(-distance),
      step(distance),
      step(-distance * 0.6),
      step(distance * 0.6),
      step(0),
    );
  }, [trigger, distance, x]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

/** The fighter tile flinching when hit: away from the hit, tilted, squashed. */
export function useFlinch(trigger: number, side: 'me' | 'rival') {
  const t = useSharedValue(0);
  useEffect(() => {
    if (trigger === 0) return;
    t.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 220 }));
  }, [trigger, t]);
  const dir = side === 'rival' ? -1 : 1;
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: 3 * dir * t.value },
      { rotate: `${(side === 'rival' ? -10 : 9) * t.value}deg` },
      { scale: 1 - 0.08 * t.value },
    ],
  }));
}
