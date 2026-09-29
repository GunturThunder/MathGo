import { StyleSheet, Text, View } from 'react-native';

/** Stand-in body for screens that later sprints build. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  note: { fontSize: 16, color: '#555', textAlign: 'center' },
});
