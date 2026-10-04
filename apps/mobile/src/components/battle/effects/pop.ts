import { useEffect } from 'react';
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../../motion/reduce-motion';
import { motion } from '../../../theme';

// The design's "mbPop": in from 40 % with a twist, overshoot to 112 %, settle. Runs on the UI
// thread; `trigger` changing restarts it (0 = stay hidden until the first trigger).
// Under Reduce Motion (GF-01) it is a short fade instead.

export const POP_MS = motion.duration.pop;

export function usePop(trigger: number, durationMs: number = POP_MS) {
  const reduced = useReduceMotion();
  const progress = useSharedValue(trigger === 0 ? 0 : 1);
  useEffect(() => {
    if (trigger === 0) return;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: reduced ? Math.min(durationMs, motion.duration.reducedFade) : durationMs,
      easing: Easing.out(Easing.quad),
    });
  }, [trigger, durationMs, progress, reduced]);
  return useAnimatedStyle(() =>
    reduced
      ? { opacity: progress.value, transform: [] }
      : {
          opacity: interpolate(progress.value, [0, 0.6, 1], [0, 1, 1]),
          transform: [
            { scale: interpolate(progress.value, [0, 0.6, 1], [0.4, 1.12, 1]) },
            { rotate: `${interpolate(progress.value, [0, 0.6, 1], [-18, 4, 0])}deg` },
          ],
        },
  );
}

/** A short horizontal shake (wrong answer), restarted when `trigger` changes. */
export function useShake(trigger: number, distance = 8) {
  const reduced = useReduceMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    // Under Reduce Motion the field stays put; the red ring and the lock still show the miss.
    if (trigger === 0 || reduced) return;
    const step = (to: number) => withTiming(to, { duration: 50 });
    x.value = withSequence(
      step(-distance),
      step(distance),
      step(-distance * 0.6),
      step(distance * 0.6),
      step(0),
    );
  }, [trigger, distance, x, reduced]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}

/** The fighter tile flinching when hit: away from the hit, tilted, squashed. */
export function useFlinch(trigger: number, side: 'me' | 'rival') {
  const reduced = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (trigger === 0 || reduced) return;
    t.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 220 }));
  }, [trigger, t, reduced]);
  const dir = side === 'rival' ? -1 : 1;
  return useAnimatedStyle(() => ({
    transform: [
      { translateX: 3 * dir * t.value },
      { rotate: `${(side === 'rival' ? -10 : 9) * t.value}deg` },
      { scale: 1 - 0.08 * t.value },
    ],
  }));
}
