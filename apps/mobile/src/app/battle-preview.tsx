import { applyBattleAction, createBattle, generateQuestion, type ArenaId } from '@mathgo/game-core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EMPTY_ENTRY, entryValue, pressKey, type KeypadKey } from '../battle/answer-entry';
import { battleView } from '../battle/battle-view';
import { BattleScreen } from '../components/battle/BattleScreen';

const TROPHIES: Record<ArenaId, number> = { 1: 150, 2: 500, 3: 842, 4: 1500, 5: 2000 };
const FIGHTERS = {
  me: { name: 'SwiftComet27', trophies: 842 },
  rival: { name: 'ZippyPrism08', trophies: 865 },
};

/**
 * Dev builds: the battle screen layout (S2-08) driven by the real engine for your answers and a
 * running clock. The rival doesn't attack yet; practice vs bot is S2-10.
 */
export default function BattlePreview() {
  const params = useLocalSearchParams<{ arena?: string }>();
  const arena = (
    Number(params.arena) >= 1 && Number(params.arena) <= 5 ? Number(params.arena) : 3
  ) as ArenaId;
  const seed = useRef(Math.floor(Math.random() * 2 ** 32));
  const startedAt = useRef(performance.now());
  const [state, setState] = useState(() =>
    createBattle({ seed: seed.current, level: { arena, trophies: TROPHIES[arena] } }),
  );
  const [now, setNow] = useState(0);
  const [entry, setEntry] = useState(EMPTY_ENTRY);

  useEffect(() => {
    const timer = setInterval(() => {
      const at = Math.round(performance.now() - startedAt.current);
      setNow(at);
      setState((s) => (s.result === null ? applyBattleAction(s, { type: 'tick', at }).state : s));
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const me = state.players[0];
  const question = useMemo(
    () => generateQuestion(state.seed, me.questionIndex, state.level),
    [state.seed, state.level, me.questionIndex],
  );
  const onKey = useCallback((key: KeypadKey) => setEntry((e) => pressKey(e, key, arena)), [arena]);
  const onSubmit = () => {
    const value = entryValue(entry);
    if (value === null || state.result !== null) return;
    const at = Math.round(performance.now() - startedAt.current);
    setState(
      (s) =>
        applyBattleAction(s, {
          type: 'answer',
          seat: 0,
          questionIndex: me.questionIndex,
          value,
          at,
        }).state,
    );
    setNow(at);
    setEntry(EMPTY_ENTRY);
  };

  return (
    <BattleScreen
      view={battleView(state, 0, FIGHTERS, now)}
      question={question.text}
      entry={entry}
      onKey={onKey}
      onSubmit={onSubmit}
      onQuit={() => router.back()}
    />
  );
}
