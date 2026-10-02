import { Canvas, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { BattleResult } from '@mathgo/game-core';
import type { Outcome } from '../../../battle/effects';
import { colors, radii, shapes, sizes, space, typography } from '../../../theme';
import { usePop } from './pop';

const BURST =
  'M45 5L54.3 16.4L69.9 10.8L66.5 29.4L88.6 30.8L73.2 45L85.6 58.2L68.7 62.2L72 82.2L53.7 71.8L45 90.5L36.1 72.3L17.7 82.6L23.4 60.7L4.1 58.3L16 45L1.7 30.9L24.2 29.9L18.3 8.2L36.4 18.5Z';
const CONFETTI = 28;
const FALL_MS = 1800;
const SHARD_COLORS = [
  shapes.triangle.face,
  shapes.circle.face,
  shapes.square.face,
  shapes.hexagon.face,
  shapes.star.face,
];

/** Fixed pseudo-random numbers, so the confetti looks scattered but renders the same each time. */
const scatter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The end of a battle (S2-09): KO, time-out or forfeit. The screen dims, a card pops in, and on
 * a win the shapes rain down as confetti. Result details come next (S2-11).
 */
export function BattleEnd({
  outcome,
  reason,
  onSeeResults,
  onPlayAgain,
}: {
  outcome: Outcome;
  reason: BattleResult['reason'];
  onSeeResults?: () => void;
  onPlayAgain?: () => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const fade = useSharedValue(0);
  const fall = useSharedValue(0);
  const cardStyle = usePop(1, 400);
  useEffect(() => {
    fade.value = withTiming(1, { duration: 250 });
    fall.value = withTiming(1, { duration: FALL_MS, easing: Easing.in(Easing.quad) });
  }, [fade, fall]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const key =
    outcome === 'draw'
      ? 'draw'
      : outcome === 'win'
        ? reason === 'ko'
          ? 'winKo'
          : 'win'
        : reason === 'ko'
          ? 'loseKo'
          : 'lose';
  return (
    <View style={StyleSheet.absoluteFill} testID="battle-end" accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
      {outcome === 'win' ? <Confetti width={width} height={height} fall={fall} /> : null}
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.badge}>
            <Canvas style={styles.badgeCanvas}>
              <Group transform={[{ scale: 84 / 92 }]}>
                <Path path={BURST} color={colors.hit} />
              </Group>
            </Canvas>
          </View>
          <Text
            style={[
              styles.title,
              outcome === 'win' ? styles.win : outcome === 'lose' ? styles.lose : null,
            ]}
            accessibilityRole="header"
            testID="battle-end-title"
          >
            {t(`battleEnd.${key}.title`)}
          </Text>
          <Text style={styles.text}>{t(`battleEnd.${key}.text`)}</Text>
          <View style={styles.buttons}>
            {onSeeResults ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSeeResults}
                style={[styles.button, styles.primary]}
                testID="battle-end-results"
              >
                <Text style={[styles.buttonLabel, styles.primaryLabel]}>
                  {t('battleEnd.seeResults')}
                </Text>
              </Pressable>
            ) : null}
            {onPlayAgain ? (
              <Pressable
                accessibilityRole="button"
                onPress={onPlayAgain}
                style={[styles.button, styles.secondary]}
                testID="battle-end-again"
              >
                <Text style={styles.buttonLabel}>{t('battleEnd.playAgain')}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function Confetti({
  width,
  height,
  fall,
}: {
  width: number;
  height: number;
  fall: SharedValue<number>;
}) {
  const shards = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        x: scatter(i, 1) * width,
        start: -40 - scatter(i, 2) * height * 0.5,
        size: 8 + scatter(i, 3) * 10,
        spin: (scatter(i, 4) - 0.5) * 12,
        drift: (scatter(i, 5) - 0.5) * 80,
        color: SHARD_COLORS[i % SHARD_COLORS.length] ?? colors.hit,
      })),
    [width, height],
  );
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" testID="confetti">
      {shards.map((s, i) => (
        <Shard key={i} shard={s} fall={fall} distance={height * 1.4} />
      ))}
    </Canvas>
  );
}

function Shard({
  shard,
  fall,
  distance,
}: {
  shard: { x: number; start: number; size: number; spin: number; drift: number; color: string };
  fall: SharedValue<number>;
  distance: number;
}) {
  const transform = useDerivedValue(() => [
    { translateX: shard.x + shard.drift * fall.value },
    { translateY: shard.start + distance * fall.value },
    { rotate: shard.spin * fall.value },
  ]);
  return (
    <Group transform={transform}>
      <RoundedRect
        x={-shard.size / 2}
        y={-shard.size / 4}
        width={shard.size}
        height={shard.size / 2}
        r={2}
        color={shard.color}
      />
    </Group>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.nightScrim },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 310,
    alignItems: 'center',
    gap: space.md - 2,
    paddingTop: space.xxl + 4,
    paddingHorizontal: space.xxl,
    paddingBottom: space.xxl,
    borderRadius: radii.card + 2,
    backgroundColor: colors.white,
  },
  badge: { width: 84, height: 84 },
  badgeCanvas: { width: 84, height: 84 },
  title: {
    ...typography.headline,
    fontSize: 40,
    lineHeight: 44,
    color: colors.ink,
    textAlign: 'center',
  },
  win: { color: colors.blue },
  lose: { color: colors.orangeInk },
  text: { ...typography.body, color: colors.ink2, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', gap: space.md - 2, marginTop: space.sm },
  button: {
    height: sizes.button - 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
  },
  primary: { backgroundColor: colors.blue, boxShadow: `0 5px 0 ${colors.blueBase}` },
  secondary: { borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white },
  buttonLabel: { ...typography.button, color: colors.ink },
  primaryLabel: { color: colors.white },
});
