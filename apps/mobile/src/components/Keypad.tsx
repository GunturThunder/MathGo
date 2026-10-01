import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { KeypadKey } from '../battle/answer-entry';
import { keyTap } from '../battle/haptics';
import { colors, radii, sizes, space, typography } from '../theme';
import { DeleteIcon, SwordIcon } from './icons';

const DIGIT_ROWS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * The battle keypad (S2-07): digits, delete and Hit!. Keys act on touch-down, not on release, so
 * typing keeps up with fast thumbs; Hit! acts on release so a slip can still be slid off.
 */
export function Keypad({
  onKey,
  onSubmit,
  canSubmit,
  locked = false,
}: {
  /** Must be stable (useCallback): keys are memoised on it. */
  onKey: (key: KeypadKey) => void;
  onSubmit: () => void;
  /** False while nothing is typed. */
  canSubmit: boolean;
  /** The 1 s lock after a wrong answer: keys show it and do nothing. */
  locked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.grid, locked && styles.locked]} testID="keypad">
      {DIGIT_ROWS.map((digit) => (
        <Key key={digit} value={digit} label={digit} onKey={onKey} disabled={locked} />
      ))}
      <Key
        value="delete"
        label={t('keypad.delete')}
        onKey={onKey}
        disabled={locked}
        variant="delete"
      />
      <Key value="0" label="0" onKey={onKey} disabled={locked} />
      <Pressable
        testID="key-submit"
        accessibilityRole="button"
        accessibilityLabel={t('keypad.submit')}
        accessibilityState={{ disabled: locked || !canSubmit }}
        disabled={locked || !canSubmit}
        onPressIn={keyTap}
        onPress={onSubmit}
        style={({ pressed }) => [
          styles.key,
          styles.submit,
          !canSubmit && styles.submitIdle,
          pressed && styles.pressed,
        ]}
      >
        <SwordIcon color={colors.white} />
        <Text style={[styles.submitLabel]}>{t('keypad.hit')}</Text>
      </Pressable>
    </View>
  );
}

const Key = memo(function Key({
  value,
  label,
  onKey,
  disabled,
  variant = 'digit',
}: {
  value: KeypadKey;
  label: string;
  onKey: (key: KeypadKey) => void;
  disabled: boolean;
  variant?: 'digit' | 'delete';
}) {
  return (
    <Pressable
      testID={`key-${value}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => {
        keyTap();
        onKey(value);
      }}
      style={({ pressed }) => [
        styles.key,
        variant === 'delete' ? styles.delete : styles.digit,
        pressed && styles.pressed,
      ]}
    >
      {variant === 'delete' ? (
        <DeleteIcon color={colors.ink} />
      ) : (
        <Text style={styles.digitLabel}>{label}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm + 2,
    paddingBottom: space.xs,
  },
  locked: { opacity: 0.45 },
  key: {
    // Three keys with two 10 px gaps.
    width: '31.5%',
    height: sizes.key,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.key,
  },
  digit: { backgroundColor: colors.white, boxShadow: `0 4px 0 ${colors.keyBase}` },
  delete: { backgroundColor: colors.line, boxShadow: `0 4px 0 ${colors.keyDeleteBase}` },
  submit: {
    flexDirection: 'row',
    gap: space.xs + 2,
    backgroundColor: colors.blue,
    boxShadow: `0 4px 0 ${colors.blueBase}`,
  },
  submitIdle: { opacity: 0.6 },
  // Pressed: the key sinks onto its base.
  pressed: { transform: [{ translateY: 4 }], boxShadow: 'none' },
  digitLabel: { ...typography.headline, fontSize: 28, lineHeight: 32, color: colors.ink },
  submitLabel: { ...typography.cardTitle, color: colors.white },
});
