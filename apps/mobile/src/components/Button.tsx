import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, sizes, space, typography } from '../theme';

export type ButtonVariant = 'primary' | 'battle' | 'violet' | 'secondary';

const FACE: Record<ButtonVariant, { bg: string; base: string; text: string }> = {
  primary: { bg: colors.blue, base: colors.blueBase, text: colors.white },
  battle: { bg: colors.orange, base: colors.orangeBase, text: colors.ink },
  violet: { bg: colors.violet, base: colors.violetBase, text: colors.white },
  secondary: { bg: colors.white, base: colors.keyBase, text: colors.ink },
};

/** The design's raised button: a face on a darker base that it sinks onto when pressed. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Waiting on the network: a spinner, no presses. */
  busy?: boolean;
  /** Shown after the label. */
  icon?: ReactNode;
  testID?: string;
}) {
  const face = FACE[variant];
  const off = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: face.bg },
        variant === 'secondary' && styles.outline,
        shadows.raised(face.base),
        off && styles.off,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={face.text} />
      ) : (
        <View style={styles.row}>
          <Text style={[styles.label, { color: face.text }]}>{label}</Text>
          {icon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.button + 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    borderRadius: radii.card,
  },
  outline: { borderWidth: 2, borderColor: colors.line },
  off: { opacity: 0.5 },
  pressed: { transform: [{ translateY: 4 }], boxShadow: 'none' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  label: { ...typography.button, fontSize: 21, lineHeight: 26 },
});
