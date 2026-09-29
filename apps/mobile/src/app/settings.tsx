import { ScrollView, StyleSheet } from 'react-native';
import { DeterminismCard } from '../components/DeterminismCard';

export default function Settings() {
  return (
    <ScrollView contentContainerStyle={styles.content} testID="settings-screen">
      <DeterminismCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, padding: 16 },
});
