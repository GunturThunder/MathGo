import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { DeterminismCard } from '../components/DeterminismCard';

export default function Home() {
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'MathGo' }} />
      <DeterminismCard />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
});
