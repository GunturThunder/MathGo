import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BattleSummary } from '../../battle/battle-result';
import { colors, radii, sizes, space, typography, type ShapeName } from '../../theme';
import { AgainIcon, CloseIcon, CrownIcon, HomeIcon, StarIcon } from '../icons';
import { ShapeFighter } from '../ShapeFighter';

/** The result screen (S2-11, design: Result board): outcome, answers, best combo, damage. */
export function ResultScreen({
  summary,
  modeLabel,
  onPlayAgain,
  onHome,
  myShape = 'triangle',
  rivalShape = 'circle',
}: {
  summary: BattleSummary;
  /** "Latihan" in practice, "Pertarungan peringkat" in ranked. */
  modeLabel: string;
  onPlayAgain: () => void;
  onHome: () => void;
  myShape?: ShapeName;
  rivalShape?: ShapeName;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { outcome, reason } = summary;
  const subtitleKey: 'draw' | `${'win' | 'lose'}_${typeof reason}` =
    outcome === 'draw' ? 'draw' : `${outcome}_${reason}`;
  return (
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
          <View style={[styles.tile, styles.tileCombo]} accessible testID="result-combo">
            <Text style={[styles.tileValue, styles.whiteText]}>{summary.bestCombo}</Text>
            <Text style={[styles.tileLabel, styles.whiteText]}>{t('result.bestCombo')}</Text>
          </View>
        </View>
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
        <Pressable
          accessibilityRole="button"
          onPress={onPlayAgain}
          style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
          testID="result-again"
        >
          <AgainIcon color={colors.white} />
          <Text style={[styles.buttonText, styles.whiteText]}>{t('result.playAgain')}</Text>
        </Pressable>
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
    </ScrollView>
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
});
