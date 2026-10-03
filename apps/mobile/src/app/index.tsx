import { Redirect, router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { useMe } from '../api/queries';
import { arenaProgress } from '../battle/arena-progress';
import { ArenaEmblem } from '../components/ArenaEmblem';
import { ChevronsIcon, HashIcon, PlusIcon, SwordIcon, TrophyIcon } from '../components/icons';
import { ShapeFighter } from '../components/ShapeFighter';
import { formatNumber } from '../lib/format';
import { updateRequired } from '../net/update-required';
import { onlineLocked } from '../profile/online';
import { profile } from '../profile/store';
import { arenaThemes, colors, radii, space, typography } from '../theme';

/** Home (S5-06, design: 03 Home): where you stand, Battle!, and battles with a friend. */
export default function Home() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const me = useMe();
  // A new install starts with the first launch flow (S3-08).
  if (!profile.get().onboarded) return <Redirect href="/welcome" />;

  // Shown at once from the last session, then from the server (and after each ranked battle).
  const player = me.data ?? api.session?.user ?? null;
  const progress = arenaProgress(player?.trophies ?? 0);
  const n = (value: number) => formatNumber(value, i18n.language);
  // Each arena has its colour and emblem (S5-10).
  const theme = arenaThemes[progress.arena];
  // Under 18 without consent, or an outdated app: online buttons explain instead (S3-09, S4-12).
  const locked = onlineLocked();
  const online = (href: Href): Href =>
    updateRequired() ? '/update-required' : locked ? '/ask-parent' : href;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl },
      ]}
      testID="home"
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('homeScreen.profile')}
          onPress={() => router.push('/settings')}
          style={styles.avatar}
          testID="home-settings"
        >
          <ShapeFighter shape="triangle" size={40} />
        </Pressable>
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1} testID="home-name">
            {player?.nickname ?? t('practice.you')}
          </Text>
          <Text style={styles.arenaLine} testID="home-arena-line">
            {t('battleScreen.arena', { number: progress.arena, name: progress.name })}
          </Text>
        </View>
        <View
          style={styles.trophies}
          accessible
          accessibilityLabel={t('homeScreen.trophiesA11y', { value: progress.trophies })}
        >
          <TrophyIcon color={colors.orangeBase} size={20} />
          <Text style={styles.trophyText} testID="home-trophies">
            {n(progress.trophies)}
          </Text>
        </View>
      </View>

      <View style={[styles.arenaCard, { backgroundColor: theme.card }]} testID="home-arena">
        <View style={[styles.circle, styles.circleBig]} />
        <View style={[styles.circle, styles.circleSmall]} />
        <View style={styles.emblem} importantForAccessibility="no-hide-descendants">
          <ArenaEmblem arena={progress.arena} size={112} />
        </View>
        <View style={styles.arenaBadge}>
          <Text style={[styles.arenaBadgeText, { color: theme.card }]}>
            {t('homeScreen.arenaBadge', { value: progress.arena })}
          </Text>
        </View>
        <Text style={styles.arenaName}>{progress.name}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress.share * 100}%` }]} />
        </View>
        <View style={styles.progressRow}>
          <TrophyIcon color={colors.white} size={18} />
          <Text style={styles.progressText} testID="home-progress">
            {progress.next === null
              ? t('homeScreen.topArena', { value: n(progress.trophies) })
              : t('homeScreen.progress', {
                  value: n(progress.trophies),
                  next: n(progress.next),
                  toGo: n(progress.toGo ?? 0),
                })}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(online('/battle'))}
        style={({ pressed }) => [styles.battle, pressed && styles.pressed]}
        testID="home-battle"
      >
        <View style={[styles.circle, styles.battleGlow]} />
        <View style={styles.battleIcon}>
          <SwordIcon color={colors.ink} size={32} />
        </View>
        <View style={styles.battleText}>
          <Text style={styles.battleTitle}>{t('home.battle')}</Text>
          <Text style={styles.battleNote}>
            {locked
              ? t('askParent.homeHint')
              : t('homeScreen.battleNote', { value: n(progress.trophies) })}
          </Text>
        </View>
        <ChevronsIcon color={colors.ink} />
      </Pressable>

      <View style={styles.friendHeader}>
        <Text style={styles.sectionTitle}>{t('homeScreen.friend')}</Text>
        <View style={styles.friendPill}>
          <Text style={styles.friendPillText}>{t('homeScreen.friendNote')}</Text>
        </View>
      </View>
      <View style={styles.friendRow}>
        <FriendCard
          title={t('home.createRoom')}
          note={t('homeScreen.createNote')}
          icon={<PlusIcon color={colors.violet} />}
          variant="violet"
          onPress={() => router.push(online('/battle?mode=create'))}
          testID="home-create-room"
        />
        <FriendCard
          title={t('home.joinRoom')}
          note={t('homeScreen.joinNote')}
          icon={<HashIcon color={colors.orangeInk} />}
          variant="orange"
          onPress={() => router.push(online('/join-room'))}
          testID="home-join-room"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/practice')}
        style={styles.practice}
        testID="home-practice"
      >
        <Text style={styles.practiceText}>{t('homeScreen.practice')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function FriendCard({
  title,
  note,
  icon,
  variant,
  onPress,
  testID,
}: {
  title: string;
  note: string;
  icon: ReactNode;
  variant: 'violet' | 'orange';
  onPress: () => void;
  testID: string;
}) {
  const violet = variant === 'violet';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.friendCard,
        violet ? styles.violet : styles.orange,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={styles.friendIcon}>{icon}</View>
      <View style={styles.spacer} />
      <Text style={[styles.friendTitle, violet ? styles.white : styles.ink]}>{title}</Text>
      <Text style={[styles.friendNote, violet ? styles.white : styles.orangeDeep]}>{note}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { flexGrow: 1, paddingHorizontal: space.xl, gap: space.lg + 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    boxShadow: `0 8px 20px ${colors.shadow}`,
  },
  who: { flex: 1, minWidth: 0 },
  name: { ...typography.cardTitle, color: colors.ink },
  arenaLine: { ...typography.caption, color: colors.ink2 },
  trophies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: 44,
    paddingLeft: space.md,
    paddingRight: space.lg,
    borderRadius: 22,
    backgroundColor: colors.white,
    boxShadow: `0 8px 20px ${colors.shadow}`,
  },
  trophyText: { ...typography.cardTitle, fontSize: 19, color: colors.ink },
  arenaCard: {
    gap: space.sm,
    paddingVertical: space.lg + 2,
    paddingHorizontal: space.xl,
    borderRadius: radii.card - 2,
    overflow: 'hidden',
  },
  emblem: { position: 'absolute', right: space.md, bottom: space.md + 2 },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: colors.glow },
  circleBig: { right: -46, top: -56, width: 190, height: 190 },
  circleSmall: { right: 64, bottom: -84, width: 150, height: 150 },
  arenaBadge: {
    alignSelf: 'flex-start',
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: space.md - 2,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  arenaBadgeText: { ...typography.label },
  arenaName: { ...typography.headline, fontSize: 28, lineHeight: 30, color: colors.white },
  track: {
    width: '75%',
    height: 8,
    marginTop: space.xs,
    borderRadius: 4,
    backgroundColor: colors.trackOnBlue,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.white },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  progressText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: typography.label.fontFamily,
    color: colors.white,
  },
  battle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    height: 100,
    paddingLeft: space.lg,
    paddingRight: space.lg + 2,
    borderRadius: radii.card,
    backgroundColor: colors.orange,
    boxShadow: `0 6px 0 ${colors.orangeBase}`,
    overflow: 'hidden',
  },
  battleGlow: { right: -24, top: -46, width: 140, height: 140, backgroundColor: colors.glowStrong },
  battleIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 33,
    backgroundColor: colors.white,
  },
  battleText: { flex: 1 },
  battleTitle: { ...typography.headline, fontSize: 36, lineHeight: 38, color: colors.ink },
  battleNote: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
    color: colors.orangeDeep,
  },
  pressed: { transform: [{ translateY: 3 }] },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  sectionTitle: { ...typography.cardTitle, color: colors.ink },
  friendPill: {
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: space.md - 2,
    borderRadius: 13,
    backgroundColor: colors.white,
  },
  friendPillText: { ...typography.caption, fontSize: 12, color: colors.ink2 },
  friendRow: { flexDirection: 'row', gap: space.md + 2 },
  friendCard: {
    flex: 1,
    height: 188,
    gap: space.xs,
    padding: space.lg + 2,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  violet: { backgroundColor: colors.violet },
  orange: { backgroundColor: colors.orange },
  friendIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: colors.white,
  },
  spacer: { flex: 1 },
  friendTitle: { ...typography.cardTitle, fontSize: 21, lineHeight: 24 },
  friendNote: { ...typography.caption },
  white: { color: colors.white },
  ink: { color: colors.ink },
  orangeDeep: { color: colors.orangeDeep },
  practice: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  practiceText: { ...typography.body, fontFamily: typography.label.fontFamily, color: colors.blue },
});
