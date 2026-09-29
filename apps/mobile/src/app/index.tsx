import { StyleSheet, Text, View } from 'react-native';
import { NavButton } from '../components/NavButton';

export default function Home() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>MathGo</Text>
      <View style={styles.buttons}>
        <NavButton href="/battle" label="Battle" testID="home-battle" />
        <NavButton href="/practice" label="Practice" testID="home-practice" />
        <NavButton href="/settings" label="Settings" testID="home-settings" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: 32, padding: 24 },
  title: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  buttons: { gap: 12 },
});
