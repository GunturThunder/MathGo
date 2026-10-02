import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  allowsNegative,
  entryValue,
  type AnswerEntry,
  type KeypadKey,
} from '../../battle/answer-entry';
import type { BattleView } from '../../battle/battle-view';
import type { QueuedEffect } from '../../battle/effects';
import { colors, radii, space, typography, type ShapeName } from '../../theme';
import { FlagIcon, LockIcon } from '../icons';
import { Keypad } from '../Keypad';
import { BattleTimer } from './BattleTimer';
import { BattleEnd } from './effects/BattleEnd';
import { usePop } from './effects/pop';
import { useEffectQueue } from './effects/use-effect-queue';
import { FighterCard } from './FighterCard';
import { QuestionPanel } from './QuestionPanel';

/** Below this height the design's 844 pt layout doesn't fit: tighter spacing, 48 pt keys. */
export const COMPACT_HEIGHT = 760;

/**
 * The battle screen (S2-08 layout, S2-09 effects; design: Battle board). Presentational only:
 * practice (S2-10) and online battles (S3-12) feed it a BattleView plus the effects to play
 * (`battleEffects()` with increasing ids), and handle the keys.
 */
export function BattleScreen({
  view,
  question,
  entry,
  onKey,
  onSubmit,
  onQuit,
  myShape = 'triangle',
  rivalShape = 'circle',
  effects = [],
  onSeeResults,
  onPlayAgain,
}: {
  view: BattleView;
  question: string;
  entry: AnswerEntry;
  onKey: (key: KeypadKey) => void;
  onSubmit: () => void;
  onQuit: () => void;
  myShape?: ShapeName;
  rivalShape?: ShapeName;
  effects?: readonly QueuedEffect[];
  onSeeResults?: () => void;
  onPlayAgain?: () => void;
}) {
  const { t } = useTranslation();
  const fx = useEffectQueue(effects);
  const lockPop = usePop(view.locked ? fx.missKey + 1 : 0);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < COMPACT_HEIGHT;
  const gap = compact ? space.sm : space.md;
  return (
    <View
      testID="battle-screen"
      style={[
        styles.screen,
        {
          gap,
          paddingTop: insets.top + (compact ? space.sm : space.lg),
          paddingBottom: insets.bottom + (compact ? space.md : space.xxl),
        },
      ]}
    >
      <View style={styles.top}>
        <Pressable
          testID="battle-quit"
          accessibilityRole="button"
          accessibilityLabel={t('battleScreen.quit')}
          onPress={onQuit}
          style={styles.quit}
        >
          <FlagIcon color={colors.ink} />
        </Pressable>
        <BattleTimer text={view.timerText} share={view.timeShare} warning={view.timerWarning} />
        <View style={styles.qWrap}>
          <View style={styles.qBadge}>
            <Text style={styles.qText} testID="question-number">
              {t('battleScreen.questionNumber', { value: view.questionNumber })}
            </Text>
          </View>
        </View>
      </View>
      <FighterCard
        fighter={view.rival}
        shape={rivalShape}
        side="rival"
        compact={compact}
        testID="fighter-rival"
        hit={fx.rivalHit}
      />
      <QuestionPanel
        question={question}
        comboLit={view.comboLit}
        comboReady={view.comboReady}
        arenaLabel={t('battleScreen.arena', { number: view.arena, name: view.arenaName })}
        entry={entry}
        showSign={allowsNegative(view.arena)}
        onKey={onKey}
        compact={compact}
        missKey={fx.missKey}
      />
      <FighterCard
        fighter={view.me}
        shape={myShape}
        side="me"
        compact={compact}
        testID="fighter-me"
        hit={fx.meHit}
      />
      <View style={styles.spacer} />
      <View>
        <Keypad
          onKey={onKey}
          onSubmit={onSubmit}
          canSubmit={entryValue(entry) !== null}
          locked={view.locked}
          compact={compact}
        />
        {view.locked ? (
          <View style={styles.lockScrim} testID="battle-locked" pointerEvents="none">
            <Animated.View style={[styles.lockBadge, lockPop]} accessibilityLiveRegion="assertive">
              <LockIcon color={colors.danger} />
              <Text style={styles.lockText}>{t('battleScreen.locked')}</Text>
            </Animated.View>
          </View>
        ) : null}
      </View>
      {fx.end ? (
        <BattleEnd
          outcome={fx.end.outcome}
          reason={fx.end.reason}
          {...(onSeeResults ? { onSeeResults } : {})}
          {...(onPlayAgain ? { onPlayAgain } : {})}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.xl, backgroundColor: colors.ground },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 58 },
  quit: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.white,
    boxShadow: `0 8px 20px ${colors.shadow}`,
  },
  // Same width as the quit button, so the timer stays centred.
  qWrap: { width: 48, alignItems: 'flex-end', overflow: 'visible' },
  qBadge: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md + 2,
    borderRadius: 18,
    backgroundColor: colors.white,
    boxShadow: `0 8px 20px ${colors.shadow}`,
  },
  qText: { ...typography.cardTitle, fontSize: 16, lineHeight: 20, color: colors.ink },
  spacer: { flex: 1 },
  lockScrim: {
    position: 'absolute',
    left: -space.sm,
    right: -space.sm,
    top: -space.sm,
    bottom: -space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.scrim,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 50,
    paddingHorizontal: space.xl,
    borderRadius: 25,
    backgroundColor: colors.white,
    boxShadow: `0 10px 24px ${colors.shadow}`,
  },
  lockText: { ...typography.cardTitle, fontSize: 18, lineHeight: 22, color: colors.ink },
});
