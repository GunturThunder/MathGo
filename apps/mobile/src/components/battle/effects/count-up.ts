import { useEffect, useState } from 'react';
import { clockNow } from '../../../lib/clock';
import { useReduceMotion } from '../../../motion/reduce-motion';

const FRAME_MS = 32;

/**
 * A number that counts from `from` to `to` over `durationMs`, eased out (S5-08's trophies). Under
 * Reduce Motion (GF-01) it shows `to` at once.
 */
export function useCountUp(from: number, to: number, durationMs = 900): number {
  const reduced = useReduceMotion();
  const [value, setValue] = useState(reduced ? to : from);
  useEffect(() => {
    if (from === to || reduced) {
      setValue(to);
      return;
    }
    const start = clockNow();
    setValue(from);
    const timer = setInterval(() => {
      const t = Math.min(1, (clockNow() - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setValue(Math.round(from + (to - from) * eased));
      if (t >= 1) clearInterval(timer);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [from, to, durationMs, reduced]);
  return value;
}
