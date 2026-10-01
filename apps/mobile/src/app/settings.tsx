import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { DeterminismCard } from '../components/DeterminismCard';
import { LanguagePicker } from '../components/LanguagePicker';
import { OnlineDevCard } from '../components/OnlineDevCard';

export default function Settings() {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={styles.content} testID="settings-screen">
      <LanguagePicker />
      <Text style={styles.heading}>{t('settings.diagnostics')}</Text>
      <DeterminismCard />
      {__DEV__ ? <OnlineDevCard /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, padding: 16 },
  heading: { fontSize: 16, fontWeight: '600' },
});
