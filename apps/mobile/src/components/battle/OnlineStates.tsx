import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatClock } from '../../battle/battle-view';
import { colors, radii, sizes, space, typography } from '../../theme';
import { WifiIcon } from '../icons';
import { usePop } from './effects/pop';

// The online battle's extra states (S4-10, design boards 05, 20 and 21).

/** Before the first question: "waiting for your rival", then 3-2-1. Covers the battle screen. */
export function PreStartOverlay({ countdown }: { countdown: number | null }) {
  const { t } = useTranslation();
  const pop = usePop(countdown ?? 0);
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.prestart]}
      testID="online-prestart"
      accessibilityLiveRegion="assertive"
    >
      {countdown === null ? (
        <>
          <Text style={styles.prestartTitle}>{t('onlineStates.waiting')}</Text>
          <Text style={styles.prestartText}>{t('onlineStates.waitingNote')}</Text>
        </>
      ) : (
        <>
          <Text style={styles.prestartText}>{t('onlineStates.startsIn')}</Text>
          <Animated.Text style={[styles.count, pop]} testID="online-countdown">
            {countdown}
          </Animated.Text>
        </>
      )}
    </View>
  );
}

/** The opponent dropped: keep answering; if they aren't back in time, you win (board 20). */
export function RivalAwayBanner({ name, secondsLeft }: { name: string; secondsLeft: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.banner} accessibilityRole="alert" testID="rival-away">
      <WifiIcon color={colors.orangeInk} size={22} off />
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>{t('onlineStates.rivalAway', { name })}</Text>
        <Text style={styles.bannerNote}>
          {t('onlineStates.rivalAwayNote', { time: formatClock(secondsLeft * 1000) })}
        </Text>
      </View>
    </View>
  );
}

/** Our connection dropped: the battle goes on while we reconnect (board 21). */
export function ReconnectingOverlay({
  secondsLeft,
  windowSeconds,
  onLeave,
}: {
  secondsLeft: number;
  windowSeconds: number;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.scrim]}
      accessibilityViewIsModal
      testID="reconnecting"
    >
      <View style={styles.card}>
        <View style={styles.wifi}>
          <WifiIcon color={colors.blue} />
        </View>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {t('onlineStates.reconnecting')}
        </Text>
        <Text style={styles.cardText}>{t('onlineStates.reconnectingNote')}</Text>
        <View style={styles.progress}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(secondsLeft / windowSeconds) * 100}%` }]} />
          </View>
          <Text style={styles.left}>
            {t('onlineStates.reconnectingLeft', { time: formatClock(secondsLeft * 1000) })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onLeave}
          style={styles.leave}
          testID="reconnecting-leave"
        >
          <Text style={styles.leaveText}>{t('onlineStates.leave')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prestart: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xxl,
    backgroundColor: colors.nightScrim,
  },
  prestartTitle: { ...typography.headline, color: colors.white, textAlign: 'center' },
  prestartText: { ...typography.bodyLarge, color: colors.white, textAlign: 'center' },
  count: { ...typography.wordmark, fontSize: 120, lineHeight: 130, color: colors.orange },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md - 2,
    paddingVertical: space.md - 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radii.lg,
    backgroundColor: colors.peach,
  },
  bannerText: { flex: 1 },
  bannerTitle: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: typography.label.fontFamily,
    color: colors.ink,
  },
  bannerNote: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.orangeDeep },
  scrim: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.scrim,
  },
  card: {
    width: '100%',
    alignItems: 'center',
    gap: space.md + 2,
    paddingTop: space.xxl + 4,
    paddingHorizontal: space.xl + 2,
    paddingBottom: space.xl + 2,
    borderRadius: radii.card + 2,
    backgroundColor: colors.white,
    boxShadow: `0 20px 40px ${colors.shadow}`,
  },
  wifi: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.sky,
  },
  cardTitle: { ...typography.headline, fontSize: 28, lineHeight: 32, color: colors.ink },
  cardText: { ...typography.body, color: colors.ink2, textAlign: 'center' },
  progress: { alignSelf: 'stretch', gap: space.xs + 2 },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.blueTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: colors.blue },
  left: { ...typography.caption, color: colors.ink2, textAlign: 'center' },
  leave: {
    minHeight: sizes.touch + 4,
    justifyContent: 'center',
    marginTop: space.xs,
    paddingHorizontal: space.xxl,
    borderRadius: 24,
    backgroundColor: colors.surfaceSoft,
  },
  leaveText: { ...typography.body, fontFamily: typography.label.fontFamily, color: colors.ink },
});
