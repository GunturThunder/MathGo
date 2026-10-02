import {
  BOT_DIFFICULTIES,
  getArena,
  type ArenaId,
  type BotDifficulty,
  generateQuestion,
} from '@mathgo/game-core';
import { router, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EMPTY_ENTRY, entryValue, pressKey, type KeypadKey } from '../battle/answer-entry';
import { battleView } from '../battle/battle-view';
import { PLAYER_SEAT } from '../battle/practice';
import { usePractice } from '../battle/use-practice';
import { BattleScreen } from '../components/battle/BattleScreen';
import { colors, radii, shadows, sizes, space, typography } from '../theme';

const ARENAS: ArenaId[] = [1, 2, 3, 4, 5];

/** Practice vs bot (S2-10, FR-13): offline, clearly labelled, no trophies. */
export default function Practice() {
  const [setup, setSetup] = useState<{ arena: ArenaId; difficulty: BotDifficulty } | null>(null);
  const [round, setRound] = useState(0);
  if (setup === null) return <PracticeSetup onStart={setSetup} />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <PracticeBattle
        key={round}
        arena={setup.arena}
        difficulty={setup.difficulty}
        onPlayAgain={() => setRound((r) => r + 1)}
      />
    </>
  );
}

function PracticeSetup({
  onStart,
}: {
  onStart: (s: { arena: ArenaId; difficulty: BotDifficulty }) => void;
}) {
  const { t } = useTranslation();
  const [arena, setArena] = useState<ArenaId>(1);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="practice-setup"
    >
      <View style={styles.intro}>
        <Text style={styles.title}>{t('practice.setupTitle')}</Text>
        <Text style={styles.note}>{t('practice.setupNote')}</Text>
      </View>
      <Text style={styles.section}>{t('practice.arena')}</Text>
      <View style={styles.list} accessibilityRole="radiogroup">
        {ARENAS.map((a) => {
          const on = a === arena;
          return (
            <Pressable
              key={a}
              testID={`practice-arena-${a}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setArena(a)}
              style={[styles.option, on && styles.optionOn]}
            >
              <View style={[styles.number, on && styles.numberOn]}>
                <Text style={[styles.numberText, on && styles.numberTextOn]}>{a}</Text>
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{getArena(a).name}</Text>
                <Text style={styles.optionHint}>{t(`practice.arena${a}`)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.section}>{t('practice.level')}</Text>
      <View style={styles.segments} accessibilityRole="radiogroup">
        {BOT_DIFFICULTIES.map((d) => {
          const on = d === difficulty;
          return (
            <Pressable
              key={d}
              testID={`practice-level-${d}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setDifficulty(d)}
              style={[styles.segment, on && styles.segmentOn]}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                {t(`practice.${d}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        testID="practice-start"
        accessibilityRole="button"
        onPress={() => onStart({ arena, difficulty })}
        style={({ pressed }) => [styles.start, pressed && styles.startPressed]}
      >
        <Text style={styles.startText}>{t('practice.start')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function PracticeBattle({
  arena,
  difficulty,
  onPlayAgain,
}: {
  arena: ArenaId;
  difficulty: BotDifficulty;
  onPlayAgain: () => void;
}) {
  const { t } = useTranslation();
  const { state, effects, now, submit } = usePractice(arena, difficulty);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const questionIndex = state.players[PLAYER_SEAT].questionIndex;
  const question = useMemo(
    () => generateQuestion(state.seed, questionIndex, state.level),
    [state.seed, state.level, questionIndex],
  );
  const fighters = useMemo(
    () => ({
      me: { name: t('practice.you'), trophies: null },
      rival: {
        name: t('practice.botName', { level: t(`practice.${difficulty}`) }),
        trophies: null,
      },
    }),
    [t, difficulty],
  );
  const onKey = useCallback((key: KeypadKey) => setEntry((e) => pressKey(e, key, arena)), [arena]);
  const onSubmit = () => {
    const value = entryValue(entry);
    if (value === null) return;
    submit(value);
    setEntry(EMPTY_ENTRY);
  };
  return (
    <BattleScreen
      view={battleView(state, PLAYER_SEAT, fighters, now)}
      question={question.text}
      entry={entry}
      onKey={onKey}
      onSubmit={onSubmit}
      onQuit={() => router.back()}
      quitLabel={t('practice.quit')}
      modeLabel={t('practice.mode', { name: getArena(arena).name })}
      myShape="triangle"
      rivalShape="square"
      effects={effects}
      onPlayAgain={onPlayAgain}
      onExit={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.ground },
  content: { gap: space.md, padding: space.xl, paddingBottom: space.xxxl },
  intro: { gap: space.xs + 2, marginBottom: space.xs },
  title: { ...typography.headline, color: colors.ink },
  note: { ...typography.body, color: colors.ink2 },
  section: { ...typography.label, color: colors.ink2, marginTop: space.sm },
  list: { gap: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 58,
    paddingVertical: space.sm,
    paddingLeft: space.xs + 2,
    paddingRight: space.lg,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.white,
  },
  optionOn: { borderColor: colors.blue, backgroundColor: colors.sky },
  number: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md - 2,
    backgroundColor: colors.surfaceSoft,
  },
  numberOn: { backgroundColor: colors.blue },
  numberText: { ...typography.cardTitle, color: colors.ink },
  numberTextOn: { color: colors.white },
  optionText: { flex: 1 },
  optionTitle: { ...typography.cardTitle, fontSize: 17, lineHeight: 20, color: colors.ink },
  optionHint: { ...typography.caption, color: colors.ink2 },
  segments: {
    flexDirection: 'row',
    gap: space.xs,
    padding: space.xs,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
  },
  segment: {
    flex: 1,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
  },
  segmentOn: { backgroundColor: colors.blue },
  segmentText: { ...typography.body, color: colors.ink2 },
  segmentTextOn: { color: colors.white },
  start: {
    height: sizes.button,
    marginTop: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.orange,
    ...shadows.raised(colors.orangeBase),
  },
  startPressed: { transform: [{ translateY: 4 }], boxShadow: 'none' },
  startText: { ...typography.button, color: colors.ink },
});
