import { JoinError, type BattleConnection, type MatchSearch } from '@mathgo/battle-client';
import type { ErrorCode, ServerMessage } from '@mathgo/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { findMatchAsPlayer } from '../net/battle';
import { profile } from '../profile/store';
import type { QueuedEffect } from './effects';
import {
  NEW_ONLINE_BATTLE,
  battleTime,
  currentQuestion,
  reduceOnline,
  type OnlineBattle,
} from './online';

export type OnlinePhase = 'searching' | 'battle' | 'error';
export type OnlineErrorCode = ErrorCode | 'connection-failed';

const TICK_MS = 250;
const MAX_EFFECTS = 20;

/**
 * A random online battle (S3-12): queue (FR-02), then show what the server sends and send the
 * player's answers. The screen re-renders on server messages and when the timer's second changes.
 */
export function useOnlineBattle() {
  const [phase, setPhase] = useState<OnlinePhase>('searching');
  const [error, setError] = useState<OnlineErrorCode | null>(null);
  const [battle, setBattle] = useState<OnlineBattle>(NEW_ONLINE_BATTLE);
  const [effects, setEffects] = useState<QueuedEffect[]>([]);
  const [now, setNow] = useState(() => performance.now());
  const [round, setRound] = useState(0);
  const ref = useRef(battle);
  const search = useRef<MatchSearch | null>(null);
  const connection = useRef<BattleConnection | null>(null);
  const effectId = useRef(0);

  const onMessage = useCallback((message: ServerMessage) => {
    const at = performance.now();
    const update = reduceOnline(ref.current, message, at);
    ref.current = update.battle;
    setBattle(update.battle);
    setNow(at);
    const fresh = update.effects.map((e) => ({ ...e, id: ++effectId.current }));
    if (fresh.length > 0) setEffects((list) => [...list.slice(-MAX_EFFECTS), ...fresh]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    ref.current = NEW_ONLINE_BATTLE;
    setBattle(NEW_ONLINE_BATTLE);
    setEffects([]);
    setError(null);
    setPhase('searching');
    (async () => {
      try {
        // An adult who skipped sign-up offline at first launch gets their account now.
        const { birthYear } = profile.get();
        if (api.session === null && birthYear !== null) await api.signUpGuest(birthYear);
        const s = await findMatchAsPlayer({ onMessage, onLeave: () => undefined });
        search.current = s;
        const conn = await s.match;
        if (cancelled) {
          void conn.leave();
          return;
        }
        connection.current = conn;
        setPhase('battle');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof JoinError && e.code !== 'cancelled' ? e.code : 'connection-failed');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
      void search.current?.cancel();
      void connection.current?.leave();
      search.current = null;
      connection.current = null;
    };
  }, [onMessage, round]);

  // The timer: re-render when its second changes, not on every tick.
  useEffect(() => {
    if (phase !== 'battle') return;
    const timer = setInterval(() => {
      const at = performance.now();
      const b = ref.current;
      if (b.end !== null || b.seat === null) return;
      const lockedUntil = b.players[b.seat].lockedUntil;
      const shown = (t: number) => {
        const bt = battleTime(b, t);
        return `${Math.floor(bt / 1000)}|${bt < lockedUntil}`;
      };
      setNow((prev) => (shown(prev) === shown(at) ? prev : at));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [phase]);

  const submit = useCallback((value: number) => {
    const q = currentQuestion(ref.current);
    if (q === null || ref.current.end !== null) return;
    connection.current?.sendAnswer(q.index, value);
  }, []);

  /** Leaves the queue or the battle (quitting a battle counts as a loss). */
  const leave = useCallback(async () => {
    await search.current?.cancel();
    await connection.current?.leave();
  }, []);

  const again = useCallback(() => setRound((r) => r + 1), []);

  return { phase, error, battle, effects, now, submit, leave, again };
}
