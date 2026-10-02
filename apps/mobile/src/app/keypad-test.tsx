import { generateQuestion, type ArenaId } from '@mathgo/game-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  EMPTY_ENTRY,
  allowsNegative,
  entryValue,
  pressKey,
  type KeypadKey,
} from '../battle/answer-entry';
import { AnswerField } from '../components/AnswerField';
import { Keypad } from '../components/Keypad';
import { colors, radii, space, typography } from '../theme';

const ARENAS: ArenaId[] = [1, 2, 3, 4, 5];
/** Mid-arena trophies, so numbers are typical for each arena. */
const TROPHIES: Record<ArenaId, number> = { 1: 150, 2: 500, 3: 950, 4: 1500, 5: 2000 };
const LOCK_MS = 1_000;

/**
 * Dev builds: try the keypad on real questions (S2-07). Shows how long a tap takes to reach the
 * screen. Not the battle screen (S2-08): no HP, timer or rival.
 */
export default function KeypadTest() {
  const { t } = useTranslation();
  const [arena, setArena] = useState<ArenaId>(3);
  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [result, setResult] = useState<{ correct: boolean; answer: number } | null>(null);
  const [locked, setLocked] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const pressedAt = useRef<number | null>(null);
  const seed = useRef(Math.floor(Math.random() * 2 ** 32));

  const question = useMemo(
    () => generateQuestion(seed.current, index, { arena, trophies: TROPHIES[arena] }),
    [arena, index],
  );

  const onKey = useCallback(
    (key: KeypadKey) => {
      pressedAt.current = performance.now();
      setEntry((current) => pressKey(current, key, arena));
    },
    [arena],
  );

  // Time from touch-down to the next frame after the answer field updated.
  useEffect(() => {
    const start = pressedAt.current;
    if (start === null) return;
    pressedAt.current = null;
    const frame = requestAnimationFrame(() => setLatencyMs(Math.round(performance.now() - start)));
    return () => cancelAnimationFrame(frame);
  }, [entry]);

  useEffect(() => {
    if (!locked) return;
    const timer = setTimeout(() => setLocked(false), LOCK_MS);
    return () => clearTimeout(timer);
  }, [locked]);

  const onSubmit = () => {
    const value = entryValue(entry);
    if (value === null) return;
    const correct = value === question.answer;
    setResult({ correct, answer: question.answer });
    setEntry(EMPTY_ENTRY);
    if (correct) setIndex((i) => i + 1);
    else setLocked(true);
  };

  const pickArena = (next: ArenaId) => {
    setArena(next);
    setEntry(EMPTY_ENTRY);
    setResult(null);
  };

  return (
    <View style={styles.screen} testID="keypad-test">
      <View style={styles.arenas} accessibilityRole="radiogroup">
        {ARENAS.map((a) => (
          <Pressable
            key={a}
            testID={`arena-${a}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: a === arena }}
            onPress={() => pickArena(a)}
            style={[styles.arena, a === arena && styles.arenaOn]}
          >
            <Text style={[styles.arenaLabel, a === arena && styles.arenaLabelOn]}>
              {t('keypadTest.arena', { value: a })}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.panel}>
        <Text style={styles.question} testID="question">
          {question.text}
        </Text>
        <AnswerField entry={entry} showSign={allowsNegative(arena)} onKey={onKey} />
      </View>
      <Text
        style={[styles.result, result !== null && !result.correct && styles.wrong]}
        testID="keypad-result"
      >
        {result === null
          ? ' '
          : result.correct
            ? t('keypadTest.correct')
            : t('keypadTest.wrong', { value: result.answer })}
      </Text>
      <Text style={styles.latency} testID="keypad-latency">
        {latencyMs === null ? ' ' : t('keypadTest.latency', { value: latencyMs })}
      </Text>
      <View style={styles.spacer} />
      <Keypad
        onKey={onKey}
        onSubmit={onSubmit}
        canSubmit={entryValue(entry) !== null}
        locked={locked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: space.md,
    padding: space.xl,
    paddingBottom: space.xxxl,
    backgroundColor: colors.ground,
  },
  arenas: {
    flexDirection: 'row',
    gap: space.xs,
    padding: space.xs,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
  },
  arena: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  arenaOn: { backgroundColor: colors.blue },
  arenaLabel: { ...typography.caption, color: colors.ink2 },
  arenaLabelOn: { color: colors.white },
  panel: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radii.card - 2,
    backgroundColor: colors.night,
  },
  question: { ...typography.question, color: colors.white, textAlign: 'center' },
  result: { ...typography.bodyLarge, color: colors.success, textAlign: 'center' },
  wrong: { color: colors.danger },
  latency: { ...typography.caption, color: colors.ink2, textAlign: 'center' },
  spacer: { flex: 1 },
});
