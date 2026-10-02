import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { NavButton } from '../components/NavButton';
import { onlineLocked } from '../profile/online';
import { profile } from '../profile/store';
import { colors, space, typography } from '../theme';

export default function Home() {
  const { t } = useTranslation();
  // A new install starts with the first launch flow (S3-08).
  if (!profile.get().onboarded) return <Redirect href="/welcome" />;
  // Under 18 without a parent's consent: Battle explains how to unlock it (S3-09).
  const locked = onlineLocked();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('app.name')}</Text>
      <View style={styles.buttons}>
        <NavButton
          href={locked ? '/ask-parent' : '/battle'}
          label={t('home.battle')}
          testID="home-battle"
          variant="battle"
        />
        {locked ? (
          <Text style={styles.hint} testID="home-locked-hint">
            {t('askParent.homeHint')}
          </Text>
        ) : null}
        <NavButton href="/practice" label={t('home.practice')} testID="home-practice" />
        <NavButton
          href="/settings"
          label={t('home.settings')}
          testID="home-settings"
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: space.xxxl,
    padding: space.xxl,
    backgroundColor: colors.ground,
  },
  title: { ...typography.wordmark, color: colors.blue, textAlign: 'center' },
  buttons: { gap: space.lg },
  hint: { ...typography.caption, color: colors.ink2, textAlign: 'center', marginTop: -space.sm },
});
