import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { api } from '../api';
import { BattleDevCard } from '../components/BattleDevCard';
import { Button } from '../components/Button';
import { DeterminismCard } from '../components/DeterminismCard';
import { LanguagePicker } from '../components/LanguagePicker';
import { MotionSetting } from '../components/MotionSetting';
import { NavButton } from '../components/NavButton';
import { OnlineDevCard } from '../components/OnlineDevCard';
import { devPretendOldVersion, setDevPretendOldVersion } from '../net/update-required';
import { onlineLocked } from '../profile/online';
import { profile } from '../profile/store';
import { colors, space, typography } from '../theme';

export default function Settings() {
  const { t } = useTranslation();
  const [pretendOld, setPretendOld] = useState(devPretendOldVersion());
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="settings-screen"
    >
      <LanguagePicker />
      <MotionSetting />
      <Text style={styles.heading}>{t('settings.diagnostics')}</Text>
      <DeterminismCard />
      {__DEV__ ? <OnlineDevCard /> : null}
      {__DEV__ && !onlineLocked() ? <BattleDevCard /> : null}
      {__DEV__ ? (
        <NavButton
          href="/keypad-test"
          label={t('keypadTest.open')}
          testID="settings-keypad-test"
          variant="secondary"
        />
      ) : null}
      {__DEV__ ? (
        <Button
          label={pretendOld ? t('updateRequired.devPretendOn') : t('updateRequired.devPretend')}
          variant={pretendOld ? 'battle' : 'secondary'}
          onPress={() => {
            setDevPretendOldVersion(!pretendOld);
            setPretendOld(!pretendOld);
          }}
          testID="settings-pretend-old"
        />
      ) : null}
      {__DEV__ ? (
        <Button
          label={t('settings.resetOnboarding')}
          variant="secondary"
          onPress={() => {
            profile.reset();
            api.signOut();
            router.replace('/');
          }}
          testID="settings-reset-onboarding"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.ground },
  content: { gap: space.lg, padding: space.lg },
  heading: { ...typography.label, color: colors.ink2 },
});
