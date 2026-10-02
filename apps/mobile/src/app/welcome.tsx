import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoltIcon, SwordIcon } from '../components/icons';
import { ShapeFighter } from '../components/ShapeFighter';
import { colors, radii, space, typography } from '../theme';

const WORDMARK = { math: 'MATH', battle: 'BATTLE' } as const;

/** First launch (design: 01 Welcome). The wordmark is the brand: the same in every language. */
export default function Welcome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl },
      ]}
      testID="welcome"
    >
      <View style={styles.hero}>
        <View style={[styles.shape, styles.triangle]}>
          <ShapeFighter shape="triangle" size={72} />
        </View>
        <View style={[styles.shape, styles.circle]}>
          <ShapeFighter shape="circle" size={60} />
        </View>
        <View style={[styles.shape, styles.square]}>
          <ShapeFighter shape="square" size={54} />
        </View>
        <View style={[styles.shape, styles.hexagon]}>
          <ShapeFighter shape="hexagon" size={44} />
        </View>
        <View style={[styles.shape, styles.star]}>
          <ShapeFighter shape="star" size={34} />
        </View>
        <View
          style={styles.wordmark}
          accessible
          accessibilityRole="header"
          accessibilityLabel={t('app.name')}
        >
          <Text style={styles.math}>{WORDMARK.math}</Text>
          <Text style={styles.battle}>{WORDMARK.battle}</Text>
        </View>
      </View>

      <View style={styles.tags}>
        <View style={[styles.tag, styles.tagOrange]}>
          <Text style={styles.tagText}>{t('welcome.tagFight')}</Text>
        </View>
        <View style={[styles.tag, styles.tagWhite]}>
          <BoltIcon color={colors.timerWarning} size={18} />
          <Text style={styles.tagText}>{t('welcome.tagBattles')}</Text>
        </View>
        <View style={[styles.tag, styles.tagOrange]}>
          <Text style={styles.tagText}>{t('welcome.tagBrain')}</Text>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.headline}>{t('welcome.headline1')}</Text>
        <Text style={styles.headline}>{t('welcome.headline2')}</Text>
        <Text style={styles.text}>{t('welcome.text')}</Text>
      </View>

      <View style={styles.spacer} />
      <Pressable
        testID="welcome-start"
        accessibilityRole="button"
        onPress={() => router.push('/onboarding/language')}
        style={({ pressed }) => [styles.start, pressed && styles.startPressed]}
      >
        <View style={[styles.startIcon, styles.startIconBlue]}>
          <SwordIcon color={colors.white} size={26} />
        </View>
        <Text style={styles.startText}>{t('welcome.start')}</Text>
        <View style={styles.startIcon} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.xl, backgroundColor: colors.ground },
  hero: { height: 300, alignItems: 'center', justifyContent: 'center' },
  shape: { position: 'absolute' },
  triangle: { left: 16, top: 10, transform: [{ rotate: '-12deg' }] },
  circle: { right: 16, top: 20 },
  square: { left: 6, bottom: 10, transform: [{ rotate: '10deg' }] },
  hexagon: { right: 10, bottom: 18, transform: [{ rotate: '-8deg' }] },
  star: { left: 160, top: 0, transform: [{ rotate: '14deg' }] },
  wordmark: { alignItems: 'center' },
  math: {
    ...typography.wordmark,
    fontSize: 104,
    lineHeight: 110,
    color: colors.blue,
    textShadowColor: colors.blueBase,
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 1,
  },
  battle: {
    ...typography.wordmark,
    fontSize: 54,
    lineHeight: 58,
    marginTop: -14,
    marginLeft: 84,
    color: colors.orange,
    transform: [{ rotate: '-5deg' }],
    textShadowColor: colors.crownBase,
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 1,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: 40,
    paddingHorizontal: space.lg,
    borderRadius: radii.lg,
  },
  tagOrange: { backgroundColor: colors.orange },
  tagWhite: { backgroundColor: colors.white },
  tagText: { ...typography.cardTitle, fontSize: 17, lineHeight: 22, color: colors.ink },
  copy: { alignItems: 'center', gap: space.sm, marginTop: space.xxl },
  headline: {
    ...typography.headline,
    fontSize: 40,
    lineHeight: 42,
    color: colors.ink,
    textAlign: 'center',
  },
  text: {
    ...typography.body,
    color: colors.ink2,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: space.xs,
  },
  spacer: { flex: 1, minHeight: space.xl },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    paddingHorizontal: space.sm,
    borderRadius: 34,
    backgroundColor: colors.white,
    boxShadow: `0 14px 30px ${colors.shadow}`,
  },
  startPressed: { transform: [{ translateY: 3 }] },
  startIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
  startIconBlue: { backgroundColor: colors.blue },
  startText: {
    ...typography.button,
    fontSize: 21,
    lineHeight: 26,
    flex: 1,
    textAlign: 'center',
    color: colors.ink,
  },
});
