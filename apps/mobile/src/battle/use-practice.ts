import type { ArenaId, BotDifficulty } from '@mathgo/game-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { battleEffects, type QueuedEffect } from './effects';
import {
  PLAYER_SEAT,
  advance,
  answer,
  startPractice,
  type Practice,
  type PracticeUpdate,
} from './practice';

const TICK_MS = 100;
const MAX_EFFECTS = 20;
const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

/**
 * Runs a practice battle on the phone's clock (S2-10): the bot answers on its own plan, the
 * clock ticks every 100 ms, and each engine update becomes screen effects.
 */
export function usePractice(arena: ArenaId, difficulty: BotDifficulty) {
  const [practice, setPractice] = useState<Practice>(() =>
    startPractice({ arena, difficulty, seed: randomSeed(), botSeed: randomSeed() }),
  );
  const [effects, setEffects] = useState<QueuedEffect[]>([]);
  const [now, setNow] = useState(0);
  // The engine runs on refs; React state mirrors them for rendering.
  const ref = useRef(practice);
  const startedAt = useRef(performance.now());
  const effectId = useRef(0);

  const clock = () => Math.round(performance.now() - startedAt.current);
  // What the screen shows besides events: the timer's second and the lock. The engine runs every
  // tick, but React only re-renders when one of these changes (S2-12).
  const shown = useRef('');
  const commit = useCallback((update: PracticeUpdate, at: number) => {
    ref.current = update.practice;
    const { state } = update.practice;
    const key = `${Math.ceil((state.rules.durationMs - at) / 1000)}|${at < state.players[PLAYER_SEAT].lockedUntil}`;
    if (update.events.length === 0 && key === shown.current) return;
    shown.current = key;
    setNow(at);
    setPractice(update.practice);
    const fresh = battleEffects(update.events, PLAYER_SEAT).map((e) => ({
      ...e,
      id: ++effectId.current,
    }));
    if (fresh.length > 0) setEffects((list) => [...list.slice(-MAX_EFFECTS), ...fresh]);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (ref.current.state.result !== null) return;
      const at = clock();
      commit(advance(ref.current, at), at);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [commit]);

  const submit = useCallback(
    (value: number) => {
      if (ref.current.state.result !== null) return;
      const at = clock();
      commit(answer(ref.current, value, at), at);
    },
    [commit],
  );

  return { state: practice.state, effects, now, submit };
}
