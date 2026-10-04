import { matchWindow } from '@mathgo/protocol';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatClock } from '../../battle/battle-view';
import { formatNumber } from '../../lib/format';
import { useReduceMotion } from '../../motion/reduce-motion';
import { colors, radii, shapes, space, typography } from '../../theme';
import { Button } from '../Button';
import { CloseIcon, TrophyIcon } from '../icons';
import { ShapeFighter } from '../ShapeFighter';

/** The practice offer unlocks after this long in the queue (S5-07, FR-13). */
export const BOT_OFFER_MS = 30_000;
const PULSE_MS = 2_000;

/**
 * Finding a random rival (S5-07, design: 04 Finding a rival): time waited, the trophy range the
 * server is matching on (it widens as you wait, FR-02), Cancel, and practice vs bot at 0:30.
 */
export function Matchmaking({
  trophies,
  waitedMs,
  onCancel,
  onPractice,
}: {
  trophies: number;
  waitedMs: number;
  onCancel: () => void;
  onPractice: () => void;
}) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const n = (value: number) => formatNumber(value, i18n.language);
  const window = matchWindow(waitedMs);
  const offer = waitedMs >= BOT_OFFER_MS;
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl },
      ]}
      testID="matchmaking"
    >
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('matchmaking.cancel')}
          onPress={onCancel}
          style={styles.cancel}
          testID="matchmaking-cancel"
        >
          <CloseIcon color={colors.ink} />
        </Pressable>
        <View style={styles.trophies}>
          <TrophyIcon color={colors.orangeBase} size={20} />
          <Text style={styles.trophyText}>{n(trophies)}</Text>
        </View>
      </View>

      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">
          {t('online.searching')}
        </Text>
        <Text style={styles.subtitle}>{t('matchmaking.subtitle')}</Text>
      </View>

      <Radar />

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('matchmaking.searching')}</Text>
          <Text style={styles.value} testID="matchmaking-waited">
            {formatClock(Math.floor(Math.max(0, waitedMs) / 1000) * 1000)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>{t('matchmaking.range')}</Text>
          <Text style={styles.value} testID="matchmaking-range">
            {`${n(Math.max(0, trophies - window))} – ${n(trophies + window)}`}
          </Text>
        </View>
        <Text style={styles.note}>{t('matchmaking.widens')}</Text>
      </View>

      <View style={styles.spacer} />
      <Button
        label={t('practice.setupTitle')}
        variant={offer ? 'primary' : 'secondary'}
        disabled={!offer}
        onPress={onPractice}
        testID="matchmaking-practice"
      />
      <Text style={styles.offerNote} testID="matchmaking-offer-note">
        {offer
          ? t('matchmaking.offer')
          : t('matchmaking.offerAt', { time: formatClock(BOT_OFFER_MS) })}
      </Text>
    </View>
  );
}

/**
 * Your shape with rings pulsing out of it: still looking. Runs on the UI thread. An idle loop, so
 * Reduce Motion leaves it out (GF-01); the time waited still counts up.
 */
function Radar() {
  const reduced = useReduceMotion();
  return (
    <View style={styles.radar} importantForAccessibility="no-hide-descendants">
      {reduced ? null : (
        <View style={StyleSheet.absoluteFill} testID="matchmaking-pulse">
          <Ring delay={0} />
          <Ring delay={PULSE_MS / 2} />
        </View>
      )}
      <View style={styles.me}>
        <ShapeFighter shape="triangle" size={56} />
      </View>
    </View>
  );
}

function Ring({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), -1),
    );
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ scale: 0.5 + t.value }],
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.xl, backgroundColor: colors.ground },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancel: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg - 2,
    backgroundColor: colors.white,
    boxShadow: `0 8px 20px ${colors.shadow}`,
  },
  trophies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: 44,
    paddingLeft: space.md,
    paddingRight: space.lg,
    borderRadius: 22,
    backgroundColor: colors.white,
  },
  trophyText: { ...typography.cardTitle, fontSize: 19, color: colors.ink },
  heading: { alignItems: 'center', gap: space.xs + 2, marginTop: space.xl },
  title: { ...typography.headline, color: colors.ink, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.ink2, textAlign: 'center' },
  radar: { height: 220, alignItems: 'center', justifyContent: 'center', marginVertical: space.lg },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: colors.blue,
  },
  me: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 48,
    backgroundColor: shapes.triangle.tile,
    borderWidth: 4,
    borderColor: colors.white,
  },
  card: {
    gap: space.md - 2,
    padding: space.lg + 2,
    borderRadius: radii.card - 2,
    backgroundColor: colors.white,
    boxShadow: `0 12px 28px ${colors.shadow}`,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...typography.body, color: colors.ink2 },
  value: { ...typography.cardTitle, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line },
  note: { ...typography.caption, color: colors.ink2 },
  spacer: { flex: 1, minHeight: space.lg },
  offerNote: {
    ...typography.caption,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: space.md,
  },
});
