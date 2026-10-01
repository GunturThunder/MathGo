import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, shadows, sizes, space, typography } from '../theme';

/** The design's three button looks: blue (main action), orange (Battle!), white. */
export type ButtonVariant = 'primary' | 'battle' | 'secondary';

export function NavButton({
  href,
  label,
  testID,
  variant = 'primary',
}: {
  href: Href;
  label: string;
  testID: string;
  variant?: ButtonVariant;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed]}
        testID={testID}
        accessibilityRole="button"
      >
        <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.button,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xxl,
    borderRadius: radii.xl,
  },
  primary: { backgroundColor: colors.blue, ...shadows.raised(colors.blueBase) },
  battle: { backgroundColor: colors.orange, ...shadows.raised(colors.orangeBase) },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
    ...shadows.raised(colors.keyBase),
  },
  // Pressed: the face sinks onto its base.
  pressed: { transform: [{ translateY: 4 }], boxShadow: 'none' },
  label: { ...typography.button },
  primaryLabel: { color: colors.white },
  // Orange takes ink text only (contrast).
  battleLabel: { color: colors.ink },
  secondaryLabel: { color: colors.ink },
});
