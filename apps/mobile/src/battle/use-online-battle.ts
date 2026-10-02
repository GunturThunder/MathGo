import {
  JoinError,
  type BattleConnection,
  type BattleHandlers,
  type Invite,
  type MatchSearch,
} from '@mathgo/battle-client';
import type { ErrorCode, ServerMessage } from '@mathgo/protocol';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { clockNow } from '../lib/clock';
import { api, type Profile } from '../api';
import { meQueryKey, queryClient } from '../api/queries';
import { createInviteAsPlayer, findMatchAsPlayer, joinRoomAsPlayer } from '../net/battle';
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

/** Where the battle comes from: the random queue, a room this player opens, or a friend's room. */
export type BattleSource =
  | { readonly kind: 'random' }
  | { readonly kind: 'create' }
  | { readonly kind: 'join'; readonly roomId: string };
export type OnlineErrorCode = ErrorCode | 'connection-failed' | 'connection-lost';

/** How long the server holds a dropped player's seat (FR-07; game-server RECONNECT_SECONDS). */
export const RECONNECT_WINDOW_MS = 15_000;

const TICK_MS = 250;
const MAX_EFFECTS = 20;

/**
 * An online battle (S3-12): a random one from the queue (FR-02), or a friend's room (S4-08,
 * S4-09). It shows what the server sends and sends the player's answers. The screen re-renders on
 * server messages and when the timer's second changes.
 */
export function useOnlineBattle(source: BattleSource = { kind: 'random' }) {
  const [phase, setPhase] = useState<OnlinePhase>('searching');
  const [error, setError] = useState<OnlineErrorCode | null>(null);
  const [battle, setBattle] = useState<OnlineBattle>(NEW_ONLINE_BATTLE);
  const [effects, setEffects] = useState<QueuedEffect[]>([]);
  const [now, setNow] = useState(() => clockNow());
  const [round, setRound] = useState(0);
  /** Local time our connection dropped, while the SDK reconnects (S4-10); null when connected. */
  const [droppedAt, setDroppedAt] = useState<number | null>(null);
  /** The room this player opened, with its code to share (S4-08). */
  const [invite, setInvite] = useState<Invite | null>(null);
  const sourceKind = source.kind;
  const roomId = source.kind === 'join' ? source.roomId : null;
  const leaving = useRef(false);
  const dropped = useRef<number | null>(null);
  dropped.current = droppedAt;
  const ref = useRef(battle);
  const search = useRef<MatchSearch | null>(null);
  const connection = useRef<BattleConnection | null>(null);
  const effectId = useRef(0);

  const onMessage = useCallback((message: ServerMessage) => {
    const at = clockNow();
    const update = reduceOnline(ref.current, message, at);
    // A ranked battle settled trophies (S5-03): Home shows the new count and arena at once
    // (S5-06), then confirms it with the server.
    const seat = update.battle.seat;
    if (message.type === 'end' && message.payload.trophies !== null && seat !== null) {
      const { trophies } = message.payload.trophies[seat];
      queryClient.setQueryData<Profile>(meQueryKey, (old) =>
        old === undefined ? old : { ...old, trophies },
      );
      void queryClient.invalidateQueries({ queryKey: meQueryKey });
    }
    // A new battle in the same room (rematch, S4-13): the last one's effects must not replay.
    const newBattle = update.battle.round !== ref.current.round;
    ref.current = update.battle;
    setBattle(update.battle);
    setNow(at);
    const fresh = update.effects.map((e) => ({ ...e, id: ++effectId.current }));
    if (newBattle) setEffects(fresh);
    else if (fresh.length > 0) setEffects((list) => [...list.slice(-MAX_EFFECTS), ...fresh]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    ref.current = NEW_ONLINE_BATTLE;
    setBattle(NEW_ONLINE_BATTLE);
    setEffects([]);
    setError(null);
    setPhase('searching');
    setDroppedAt(null);
    setInvite(null);
    leaving.current = false;
    (async () => {
      try {
        // An adult who skipped sign-up offline at first launch gets their account now.
        const { birthYear } = profile.get();
        if (api.session === null && birthYear !== null) await api.signUpGuest(birthYear);
        const handlers: BattleHandlers = {
          onMessage,
          onDrop: () => {
            const at = clockNow();
            setDroppedAt(at);
            setNow(at);
          },
          onReconnect: () => setDroppedAt(null),
          // Gone for good mid-battle (not our own Leave, not after the end): the seat is lost.
          onLeave: () => {
            setDroppedAt(null);
            if (!leaving.current && ref.current.end === null && ref.current.seat !== null) {
              setError('connection-lost');
              setPhase('error');
            }
          },
        };
        let conn: BattleConnection;
        if (sourceKind === 'random') {
          const s = await findMatchAsPlayer(handlers);
          search.current = s;
          conn = await s.match;
        } else if (sourceKind === 'create') {
          const created = await createInviteAsPlayer();
          if (!cancelled) setInvite(created);
          conn = await joinRoomAsPlayer(created.roomId, handlers);
        } else {
          conn = await joinRoomAsPlayer(roomId ?? '', handlers);
        }
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
  }, [onMessage, round, sourceKind, roomId]);

  // The timer: re-render when its second changes, not on every tick.
  useEffect(() => {
    if (phase !== 'battle') return;
    const timer = setInterval(() => {
      const at = clockNow();
      const b = ref.current;
      if (b.end !== null || b.seat === null) return;
      const lockedUntil = b.players[b.seat].lockedUntil;
      // Everything on screen that moves with time: the clock, the lock, the 3-2-1, the
      // opponent's reconnect countdown and our own.
      const shown = (t: number) => {
        const bt = battleTime(b, t);
        return [
          Math.floor(bt / 1000),
          bt < lockedUntil,
          b.startsAt === null ? '' : Math.ceil((b.startsAt - t) / 1000),
          b.rivalAwayUntil === null ? '' : Math.ceil((b.rivalAwayUntil - bt) / 1000),
          dropped.current === null ? '' : Math.ceil((t - dropped.current) / 1000),
        ].join('|');
      };
      setNow((prev) => (shown(prev) === shown(at) ? prev : at));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [phase]);

  // Back from the background (S4-11): catch the screen up at once. The connection resumes or
  // reconnects on its own (the SDK), and the server resends the state after a reconnect.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(clockNow());
    });
    return () => sub.remove();
  }, []);

  const submit = useCallback((value: number) => {
    const q = currentQuestion(ref.current);
    if (q === null || ref.current.end !== null) return;
    connection.current?.sendAnswer(q.index, value);
  }, []);

  /** Leaves the queue or the battle (quitting a battle counts as a loss). */
  const leave = useCallback(async () => {
    leaving.current = true;
    await search.current?.cancel();
    await connection.current?.leave();
  }, []);

  /** "Play again?" after a friendly match (S4-13); the server starts it when both say yes. */
  const rematch = useCallback((accept: boolean) => connection.current?.requestRematch(accept), []);

  /** Dev builds: drop the connection for `ms`, to check the reconnect states (S4-10). */
  const devDrop = useCallback((ms: number) => connection.current?.devSimulateDrop(ms), []);

  /** Whole seconds left to get back before the seat is lost, while reconnecting. */
  const reconnectSecondsLeft =
    droppedAt === null
      ? null
      : Math.max(0, Math.ceil((droppedAt + RECONNECT_WINDOW_MS - now) / 1000));

  const again = useCallback(() => setRound((r) => r + 1), []);

  return {
    phase,
    error,
    battle,
    effects,
    now,
    submit,
    leave,
    again,
    reconnectSecondsLeft,
    devDrop,
    invite,
    rematch,
  };
}
