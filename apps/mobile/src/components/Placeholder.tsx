import { StyleSheet, Text, View } from 'react-native';
import { colors, space, typography } from '../theme';

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
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.lg,
    backgroundColor: colors.ground,
  },
  title: { ...typography.headline, color: colors.ink },
  note: { ...typography.body, color: colors.ink2, textAlign: 'center' },
});
