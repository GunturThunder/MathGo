import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { NavButton } from '../components/NavButton';
import { colors, space, typography } from '../theme';

export default function Home() {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('app.name')}</Text>
      <View style={styles.buttons}>
        <NavButton href="/battle" label={t('home.battle')} testID="home-battle" variant="battle" />
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
});
