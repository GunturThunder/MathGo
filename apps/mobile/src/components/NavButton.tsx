import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

export function NavButton({ href, label, testID }: { href: Href; label: string; testID: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.button} testID={testID} accessibilityRole="button">
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#222',
  },
  label: { fontSize: 18, fontWeight: '600', color: '#fff' },
});
