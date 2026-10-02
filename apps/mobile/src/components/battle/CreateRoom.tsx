import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../Button';
import { OnboardingScreen } from '../onboarding/Screen';
import { colors, radii, space, typography } from '../../theme';

/**
 * A room for a friend (S4-08, design: 08 Create room): the code, Copy and Share (WhatsApp is in
 * the share sheet), and "waiting for your friend" until they join. `code` is null while the room
 * is being made.
 */
export function CreateRoom({ code, onBack }: { code: string | null; onBack: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const share = () => {
    if (code === null) return;
    void Share.share({ message: t('invite.shareMessage', { code }) });
  };
  const copy = async () => {
    if (code === null) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
  };
  return (
    <OnboardingScreen
      testID="create-room"
      title={t('invite.title')}
      subtitle={t('invite.subtitle')}
      onBack={onBack}
      footer={
        <>
          <Button
            label={t('invite.share')}
            variant="violet"
            onPress={share}
            disabled={code === null}
            testID="invite-share"
          />
          <Text style={styles.footnote}>{t('invite.friendly')}</Text>
        </>
      }
    >
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.label}>{t('invite.codeLabel')}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t('invite.friendlyPill')}</Text>
          </View>
        </View>
        {code === null ? (
          <ActivityIndicator color={colors.violet} style={styles.loading} />
        ) : (
          <View
            style={styles.tiles}
            accessible
            accessibilityLabel={t('invite.codeA11y', { code: [...code].join(' ') })}
            testID="invite-code"
          >
            {[...code].map((ch, i) => (
              <View key={i} style={styles.tile}>
                <Text style={styles.tileText}>{ch}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.note}>{t('invite.noLookAlikes')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void copy()}
          disabled={code === null}
          style={styles.copy}
          testID="invite-copy"
        >
          <Text style={styles.copyText}>{copied ? t('invite.copied') : t('invite.copy')}</Text>
        </Pressable>
      </View>
      <View style={styles.waiting} accessibilityLiveRegion="polite">
        <Text style={styles.vs}>{t('invite.vs')}</Text>
        <Text style={styles.waitingTitle}>{t('invite.waiting')}</Text>
        <Text style={styles.waitingNote}>{t('invite.open10')}</Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md + 2,
    padding: space.lg + 2,
    borderRadius: radii.card - 2,
    backgroundColor: colors.white,
    boxShadow: `0 12px 28px ${colors.shadow}`,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...typography.label, color: colors.ink2 },
  pill: {
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: space.md - 2,
    borderRadius: 13,
    backgroundColor: colors.lilac,
  },
  pillText: { ...typography.caption, fontSize: 12, color: colors.violetBase },
  loading: { height: 64 },
  tiles: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: {
    width: '15%',
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.lilac,
    boxShadow: `0 4px 0 ${colors.violetBase}`,
  },
  tileText: { ...typography.headline, fontSize: 32, lineHeight: 38, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2, textAlign: 'center' },
  copy: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: 22,
    backgroundColor: colors.surfaceSoft,
  },
  copyText: {
    ...typography.body,
    fontFamily: typography.label.fontFamily,
    color: colors.violetBase,
  },
  waiting: { alignItems: 'center', gap: space.xs, paddingVertical: space.lg },
  vs: { ...typography.headline, color: colors.violet },
  waitingTitle: { ...typography.cardTitle, color: colors.ink },
  waitingNote: { ...typography.caption, color: colors.ink2 },
  footnote: { ...typography.caption, color: colors.ink2, textAlign: 'center' },
});
