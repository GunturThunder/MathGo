import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { BattleDevCard } from '../components/BattleDevCard';
import { DeterminismCard } from '../components/DeterminismCard';
import { LanguagePicker } from '../components/LanguagePicker';
import { NavButton } from '../components/NavButton';
import { OnlineDevCard } from '../components/OnlineDevCard';
import { colors, space, typography } from '../theme';

export default function Settings() {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="settings-screen"
    >
      <LanguagePicker />
      <Text style={styles.heading}>{t('settings.diagnostics')}</Text>
      <DeterminismCard />
      {__DEV__ ? <OnlineDevCard /> : null}
      {__DEV__ ? <BattleDevCard /> : null}
      {__DEV__ ? (
        <NavButton
          href="/keypad-test"
          label={t('keypadTest.open')}
          testID="settings-keypad-test"
          variant="secondary"
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
