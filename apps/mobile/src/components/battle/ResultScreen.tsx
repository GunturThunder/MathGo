import { ARENAS } from '@mathgo/game-core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arenaProgress } from '../../battle/arena-progress';
import type { BattleSummary, TrophyResult } from '../../battle/battle-result';
import { unlockFeedback } from '../../battle/haptics';
import { formatNumber } from '../../lib/format';
import { colors, radii, sizes, space, typography, type ShapeName } from '../../theme';
import { Button } from '../Button';
import { AgainIcon, CloseIcon, CrownIcon, HomeIcon, StarIcon, TrophyIcon } from '../icons';
import { ShapeFighter } from '../ShapeFighter';
import { useCountUp } from './effects/count-up';
import { usePop } from './effects/pop';

/** "+30", "−20", "0". */
function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : delta < 0 ? `\u2212${-delta}` : '0';
}

/**
 * The result screen (S2-11, design: Result board): outcome, answers, best combo, damage. Ranked
 * battles (S5-08) show the trophy change instead of the best combo, the new count, and a new
 * arena when one opened.
 */
export function ResultScreen({
  summary,
  modeLabel,
  onPlayAgain,
  onHome,
  playAgainNote,
  playAgainDisabled = false,
  myShape = 'triangle',
  rivalShape = 'circle',
}: {
  summary: BattleSummary;
  /** "Latihan" in practice, "Pertarungan peringkat" in ranked. */
  modeLabel: string;
  /** Left out where there's no "play again" (friendly matches until the rematch, S4-13). */
  onPlayAgain?: () => void;
  onHome: () => void;
  /** Under "play again": where a friendly rematch stands (S4-13). */
  playAgainNote?: string;
  playAgainDisabled?: boolean;
  myShape?: ShapeName;
  rivalShape?: ShapeName;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { outcome, reason, trophies } = summary;
  const unlocked = trophies !== null && trophies.arenaAfter > trophies.arenaBefore;
  const [showUnlock, setShowUnlock] = useState(unlocked);
  const subtitleKey: 'draw' | `${'win' | 'lose'}_${typeof reason}` =
    outcome === 'draw' ? 'draw' : `${outcome}_${reason}`;
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl },
        ]}
        testID="result-screen"
      >
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('result.close')}
            onPress={onHome}
            style={styles.close}
            testID="result-close"
          >
            <CloseIcon color={colors.ink} />
          </Pressable>
          <View style={styles.mode}>
            <Text style={styles.modeText}>{modeLabel}</Text>
          </View>
        </View>

        <View style={styles.heading}>
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header" testID="result-title">
              {t(`result.title.${outcome}`)}
            </Text>
            {outcome === 'win' ? (
              <View style={styles.crown}>
                <CrownIcon fill={colors.orange} stroke={colors.crownBase} />
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle} testID="result-subtitle">
            {t(`result.subtitle.${subtitleKey}`, {
              name: summary.rival.name,
              seconds: summary.secondsLeft,
            })}
          </Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.tiles}>
            <View style={[styles.tile, styles.tileAnswers]} accessible testID="result-answers">
              <Text style={[styles.tileValue, styles.inkText]}>
                {t('result.answersValue', { correct: summary.correct, answered: summary.answered })}
              </Text>
              <Text style={[styles.tileLabel, styles.orangeDeep]}>{t('result.answers')}</Text>
            </View>
            {trophies === null ? (
              <View style={[styles.tile, styles.tileCombo]} accessible testID="result-combo">
                <Text style={[styles.tileValue, styles.whiteText]}>{summary.bestCombo}</Text>
                <Text style={[styles.tileLabel, styles.whiteText]}>{t('result.bestCombo')}</Text>
              </View>
            ) : (
              <View style={[styles.tile, styles.tileCombo]} accessible testID="result-trophy-delta">
                <Text style={[styles.tileValue, styles.whiteText]}>{signed(trophies.delta)}</Text>
                <Text style={[styles.tileLabel, styles.whiteText]}>{t('result.trophies')}</Text>
              </View>
            )}
          </View>
          {trophies === null ? null : <TrophiesNow trophies={trophies} />}
          <View style={styles.podium}>
            <Column
              name={t('result.you')}
              damage={summary.me.damage}
              shape={myShape}
              side="me"
              rank={outcome === 'win' ? 1 : outcome === 'lose' ? 2 : null}
              testID="result-me"
            />
            <Column
              name={summary.rival.name}
              damage={summary.rival.damage}
              shape={rivalShape}
              side="rival"
              rank={outcome === 'lose' ? 1 : outcome === 'win' ? 2 : null}
              testID="result-rival"
            />
          </View>
        </View>

        <View style={styles.spacer} />
        <View style={styles.buttons}>
          {onPlayAgain ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: playAgainDisabled }}
              disabled={playAgainDisabled}
              onPress={onPlayAgain}
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                playAgainDisabled && styles.off,
                pressed && styles.pressed,
              ]}
              testID="result-again"
            >
              <AgainIcon color={colors.white} />
              <Text style={[styles.buttonText, styles.whiteText]}>{t('result.playAgain')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onHome}
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
            testID="result-home"
          >
            <HomeIcon color={colors.ink} />
            <Text style={[styles.buttonText, styles.inkText]}>{t('result.home')}</Text>
          </Pressable>
        </View>
        {playAgainNote ? (
          <Text style={styles.note} accessibilityLiveRegion="polite" testID="result-rematch">
            {playAgainNote}
          </Text>
        ) : null}
      </ScrollView>
      {showUnlock && trophies !== null ? (
        <ArenaUnlock arena={trophies.arenaAfter} onClose={() => setShowUnlock(false)} />
      ) : null}
    </View>
  );
}

/** "Trofi sekarang": the new count, counting up (or down) from before, and the next arena. */
function TrophiesNow({ trophies }: { trophies: TrophyResult }) {
  const { t, i18n } = useTranslation();
  const n = (value: number) => formatNumber(value, i18n.language);
  const shown = useCountUp(trophies.now - trophies.delta, trophies.now);
  const progress = arenaProgress(trophies.now);
  return (
    <View
      style={styles.now}
      accessible
      accessibilityLabel={`${t('result.trophiesNow')}: ${n(trophies.now)}`}
      testID="result-trophies-now"
    >
      <View style={styles.nowCount}>
        <TrophyIcon color={colors.orange} size={22} />
        <View>
          <Text style={styles.nowLabel}>{t('result.trophiesNow')}</Text>
          <Text style={styles.nowValue} testID="result-trophies-value">
            {n(shown)}
          </Text>
        </View>
      </View>
      <View style={styles.nowPill}>
        <Text style={styles.nowPillText} numberOfLines={1} testID="result-next-arena">
          {progress.next === null
            ? t('result.topArena')
            : t('result.toNext', { toGo: n(progress.toGo ?? 0), name: progress.nextName })}
        </Text>
      </View>
    </View>
  );
}

/** The moment a new arena opens (S5-08): its name and what's asked there, with a pop. */
function ArenaUnlock({
  arena,
  onClose,
}: {
  arena: TrophyResult['arenaAfter'];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const pop = usePop(1, 500);
  const name = ARENAS.find((a) => a.id === arena)?.name ?? '';
  useEffect(() => unlockFeedback(), []);
  return (
    <View style={styles.scrim} accessibilityViewIsModal testID="result-unlock">
      <Animated.View style={[styles.unlockCard, pop]}>
        <View style={styles.unlockBadge}>
          <Text style={styles.unlockBadgeText}>{t('result.unlockBadge', { value: arena })}</Text>
        </View>
        <Text style={styles.unlockTitle} accessibilityRole="header">
          {t('result.unlockTitle')}
        </Text>
        <Text style={styles.unlockName} testID="result-unlock-name">
          {name}
        </Text>
        <Text style={styles.unlockText}>{t(`practice.arena${arena}`)}</Text>
        <View style={styles.unlockButton}>
          <Button label={t('result.unlockOk')} onPress={onClose} testID="result-unlock-ok" />
        </View>
      </Animated.View>
    </View>
  );
}

/** One podium column: shape, crown for the winner, name, damage, and a block with the rank. */
function Column({
  name,
  damage,
  shape,
  side,
  rank,
  testID,
}: {
  name: string;
  damage: number;
  shape: ShapeName;
  side: 'me' | 'rival';
  /** Null on a draw: equal blocks. */
  rank: 1 | 2 | null;
  testID: string;
}) {
  const { t } = useTranslation();
  const height = rank === 1 ? 84 : rank === 2 ? 56 : 70;
  return (
    <View style={styles.column} testID={testID}>
      <View style={styles.avatar}>
        <ShapeFighter shape={shape} size={36} />
        {rank === 1 ? (
          <View style={styles.smallCrown}>
            <CrownIcon fill={colors.orange} stroke={colors.night} size={24} />
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.damage}>
        <StarIcon color={colors.orange} />
        <Text style={styles.damageText}>{t('result.damage', { value: damage })}</Text>
      </View>
      <View
        style={[
          styles.block,
          { height, backgroundColor: side === 'me' ? colors.blue : colors.orange },
        ]}
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[styles.rank, { fontSize: rank === 1 ? 64 : 46 }]}>{rank ?? '='}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  screen: { backgroundColor: colors.ground },
  content: { flexGrow: 1, paddingHorizontal: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52 },
  close: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg - 2,
    backgroundColor: colors.white,
    boxShadow: `0 8px 20px ${colors.shadow}`,
  },
  mode: {
    height: 32,
    justifyContent: 'center',
    paddingHorizontal: space.md + 2,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  modeText: { ...typography.caption, color: colors.ink2 },
  heading: { gap: space.xs, marginTop: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { ...typography.headline, fontSize: 46, lineHeight: 50, color: colors.ink },
  crown: { transform: [{ rotate: '10deg' }] },
  subtitle: { ...typography.body, color: colors.ink2 },
  panel: {
    gap: space.md + 2,
    marginTop: space.lg + 2,
    paddingTop: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: 36,
    backgroundColor: colors.night,
    overflow: 'hidden',
  },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: {
    flex: 1,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
  },
  tileAnswers: { backgroundColor: colors.orange },
  tileCombo: { backgroundColor: colors.violet },
  tileValue: { ...typography.stat, fontSize: 34, lineHeight: 38 },
  tileLabel: { ...typography.caption, fontFamily: typography.label.fontFamily },
  inkText: { color: colors.ink },
  whiteText: { color: colors.white },
  orangeDeep: { color: colors.orangeDeep },
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    padding: space.md,
    borderRadius: radii.xl,
    backgroundColor: colors.nightPill,
  },
  nowCount: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nowLabel: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.nightMuted },
  nowValue: { ...typography.stat, fontSize: 28, lineHeight: 32, color: colors.white },
  nowPill: {
    flexShrink: 1,
    height: 30,
    justifyContent: 'center',
    paddingHorizontal: space.md - 2,
    borderRadius: 15,
    backgroundColor: colors.nightRaised,
  },
  nowPillText: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.white },
  scrim: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.scrim,
  },
  unlockCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: space.sm,
    padding: space.xl,
    borderRadius: 32,
    backgroundColor: colors.white,
    boxShadow: `0 16px 40px ${colors.shadow}`,
  },
  unlockBadge: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: 14,
    backgroundColor: colors.violet,
  },
  unlockBadgeText: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.white },
  unlockTitle: { ...typography.cardTitle, color: colors.ink2, textAlign: 'center' },
  unlockName: { ...typography.headline, color: colors.ink, textAlign: 'center' },
  unlockText: {
    ...typography.body,
    color: colors.ink2,
    textAlign: 'center',
    marginBottom: space.md,
  },
  unlockButton: { alignSelf: 'stretch' },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: space.md - 2,
    marginTop: space.xs,
  },
  column: { width: 124, alignItems: 'center', gap: space.xs + 2 },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.white,
  },
  smallCrown: { position: 'absolute', top: -16, left: 14 },
  name: {
    ...typography.cardTitle,
    fontSize: 16,
    lineHeight: 20,
    color: colors.white,
    maxWidth: 124,
  },
  damage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 26,
    paddingHorizontal: space.md - 2,
    borderRadius: 13,
    backgroundColor: colors.nightPill,
  },
  damageText: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.white },
  block: {
    width: 124,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: radii.lg - 2,
    borderTopRightRadius: radii.lg - 2,
  },
  rank: { ...typography.headline, lineHeight: undefined, color: colors.white, opacity: 0.7 },
  spacer: { flex: 1, minHeight: space.xl },
  buttons: { flexDirection: 'row', gap: space.md },
  button: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    height: sizes.button + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
  },
  primary: { backgroundColor: colors.blue, boxShadow: `0 6px 0 ${colors.blueBase}` },
  secondary: { backgroundColor: colors.white, boxShadow: `0 6px 0 ${colors.keyBase}` },
  pressed: { transform: [{ translateY: 4 }], boxShadow: 'none' },
  buttonText: { ...typography.button },
  off: { opacity: 0.5 },
  note: { ...typography.caption, color: colors.ink2, textAlign: 'center', marginTop: space.md },
});
