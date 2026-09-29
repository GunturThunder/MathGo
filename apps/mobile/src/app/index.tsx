import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { NavButton } from '../components/NavButton';

export default function Home() {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('app.name')}</Text>
      <View style={styles.buttons}>
        <NavButton href="/battle" label={t('home.battle')} testID="home-battle" />
        <NavButton href="/practice" label={t('home.practice')} testID="home-practice" />
        <NavButton href="/settings" label={t('home.settings')} testID="home-settings" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 32, padding: 24 },
  title: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  buttons: { gap: 12 },
});
