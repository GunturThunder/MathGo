import {
  applyBattleAction,
  createBattle,
  generateQuestion,
  type ArenaId,
  type BattleAction,
  type BattleState,
} from '@mathgo/game-core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY_ENTRY, entryValue, pressKey, type KeypadKey } from '../battle/answer-entry';
import { battleView } from '../battle/battle-view';
import { battleEffects, type QueuedEffect } from '../battle/effects';
import { BattleScreen } from '../components/battle/BattleScreen';

const TROPHIES: Record<ArenaId, number> = { 1: 150, 2: 500, 3: 842, 4: 1500, 5: 2000 };
const FIGHTERS = {
  me: { name: 'SwiftComet27', trophies: 842 },
  rival: { name: 'ZippyPrism08', trophies: 865 },
};
/** The stand-in rival answers every 3–6 s, right 3 times in 4. The real bot is S2-10. */
const RIVAL_EVERY_MS = [3_000, 6_000] as const;
const RIVAL_RIGHT = 0.75;

const newBattle = (arena: ArenaId) =>
  createBattle({
    seed: Math.floor(Math.random() * 2 ** 32),
    level: { arena, trophies: TROPHIES[arena] },
  });

/**
 * Dev builds: the battle screen (S2-08) with its effects (S2-09), driven by the real engine for
 * your answers, a running clock and a simple stand-in rival.
 */
export default function BattlePreview() {
  const params = useLocalSearchParams<{ arena?: string }>();
  const arena = (
    Number(params.arena) >= 1 && Number(params.arena) <= 5 ? Number(params.arena) : 3
  ) as ArenaId;
  const startedAt = useRef(performance.now());
  const nextRivalAt = useRef<number>(RIVAL_EVERY_MS[0]);
  const effectId = useRef(0);
  const [state, setState] = useState<BattleState>(() => newBattle(arena));
  // The engine runs on this ref; React state only mirrors it for rendering.
  const stateRef = useRef(state);
  const [effects, setEffects] = useState<QueuedEffect[]>([]);
  const [now, setNow] = useState(0);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [round, setRound] = useState(0);

  const clock = () => Math.round(performance.now() - startedAt.current);
  const apply = useCallback((action: BattleAction) => {
    if (stateRef.current.result !== null) return;
    const update = applyBattleAction(stateRef.current, action);
    stateRef.current = update.state;
    setState(update.state);
    const fresh = battleEffects(update.events, 0).map((e) => ({ ...e, id: ++effectId.current }));
    if (fresh.length > 0) setEffects((list) => [...list.slice(-20), ...fresh]);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const at = clock();
      setNow(at);
      if (at >= nextRivalAt.current) {
        const [lo, hi] = RIVAL_EVERY_MS;
        nextRivalAt.current = at + lo + Math.random() * (hi - lo);
        const s = stateRef.current;
        const q = s.players[1].questionIndex;
        const answer = generateQuestion(s.seed, q, s.level).answer;
        apply({
          type: 'answer',
          seat: 1,
          questionIndex: q,
          value: Math.random() < RIVAL_RIGHT ? answer : answer + 1,
          at,
        });
      } else {
        apply({ type: 'tick', at });
      }
    }, 250);
    return () => clearInterval(timer);
  }, [apply, round]);

  const me = state.players[0];
  const question = useMemo(
    () => generateQuestion(state.seed, me.questionIndex, state.level),
    [state.seed, state.level, me.questionIndex],
  );
  const onKey = useCallback((key: KeypadKey) => setEntry((e) => pressKey(e, key, arena)), [arena]);
  const onSubmit = () => {
    const value = entryValue(entry);
    if (value === null) return;
    const at = clock();
    apply({ type: 'answer', seat: 0, questionIndex: me.questionIndex, value, at });
    setNow(at);
    setEntry(EMPTY_ENTRY);
  };
  const playAgain = () => {
    startedAt.current = performance.now();
    nextRivalAt.current = RIVAL_EVERY_MS[0];
    stateRef.current = newBattle(arena);
    setState(stateRef.current);
    setEffects([]);
    setEntry(EMPTY_ENTRY);
    setNow(0);
    setRound((r) => r + 1);
  };

  return (
    <BattleScreen
      key={round}
      view={battleView(state, 0, FIGHTERS, now)}
      question={question.text}
      entry={entry}
      onKey={onKey}
      onSubmit={onSubmit}
      onQuit={() => router.back()}
      effects={effects}
      onPlayAgain={playAgain}
    />
  );
}
