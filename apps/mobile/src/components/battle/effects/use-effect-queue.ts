import { useEffect, useRef, useState } from 'react';
import type { Outcome, QueuedEffect } from '../../../battle/effects';
import { endFeedback, hitFeedback } from '../../../battle/haptics';
import type { HitOn } from '../FighterCard';
import { HIT_BURST_MS } from './HitBurst';
import type { BattleResult } from '@mathgo/game-core';

export interface EffectState {
  readonly rivalHit: HitOn | null;
  readonly meHit: HitOn | null;
  /** Bumps on each of my wrong answers. */
  readonly missKey: number;
  readonly end: { readonly outcome: Outcome; readonly reason: BattleResult['reason'] } | null;
}

/** Plays new effects (ids above the last one seen) in order; bursts clear after they finish. */
export function useEffectQueue(effects: readonly QueuedEffect[]): EffectState {
  const lastId = useRef(0);
  const [state, setState] = useState<EffectState>({
    rivalHit: null,
    meHit: null,
    missKey: 0,
    end: null,
  });

  useEffect(() => {
    const fresh = effects.filter((e) => e.id > lastId.current);
    if (fresh.length === 0) return;
    lastId.current = Math.max(...fresh.map((e) => e.id));
    setState((s) => {
      let next = s;
      for (const e of fresh) {
        if (e.kind === 'hit') {
          const hit = { id: e.id, damage: e.damage, fast: e.fast };
          if (e.by === 'me') next = { ...next, rivalHit: hit };
          else {
            next = { ...next, meHit: hit };
            hitFeedback();
          }
        } else if (e.kind === 'miss' && e.side === 'me') {
          next = { ...next, missKey: next.missKey + 1 };
        } else if (e.kind === 'end') {
          next = { ...next, end: { outcome: e.outcome, reason: e.reason } };
          endFeedback(e.outcome === 'win');
        }
      }
      return next;
    });
  }, [effects]);

  // Each burst clears itself once played.
  const rivalId = state.rivalHit?.id;
  const meId = state.meHit?.id;
  useEffect(() => {
    if (rivalId === undefined) return;
    const timer = setTimeout(
      () => setState((s) => (s.rivalHit?.id === rivalId ? { ...s, rivalHit: null } : s)),
      HIT_BURST_MS,
    );
    return () => clearTimeout(timer);
  }, [rivalId]);
  useEffect(() => {
    if (meId === undefined) return;
    const timer = setTimeout(
      () => setState((s) => (s.meHit?.id === meId ? { ...s, meHit: null } : s)),
      HIT_BURST_MS,
    );
    return () => clearTimeout(timer);
  }, [meId]);

  return state;
}
