import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatEntry, type AnswerEntry, type KeypadKey } from '../battle/answer-entry';
import { keyTap } from '../battle/haptics';
import { colors, radii, sizes, space, typography } from '../theme';

// Maths symbols: the same in every language, so not in the translation files.
const EQUALS = '=';
const PLUS_MINUS = '±';
const EMPTY = '?';

/** "= [answer]" under the question, with the ± key in Power Peak only (design: Battle board). */
export function AnswerField({
  entry,
  showSign,
  onKey,
  compact = false,
}: {
  entry: AnswerEntry;
  showSign: boolean;
  onKey: (key: KeypadKey) => void;
  /** Small phones: a shorter field. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const text = formatEntry(entry);
  return (
    <View style={styles.row}>
      <Text style={styles.equals} importantForAccessibility="no">
        {EQUALS}
      </Text>
      {showSign ? (
        <Pressable
          testID="key-sign"
          accessibilityRole="button"
          accessibilityLabel={t('keypad.sign')}
          onPressIn={() => {
            keyTap();
            onKey('sign');
          }}
          style={styles.sign}
        >
          <Text style={styles.signLabel}>{PLUS_MINUS}</Text>
        </Pressable>
      ) : null}
      <View
        style={[styles.field, compact && styles.fieldCompact]}
        accessible
        accessibilityLabel={t('keypad.answer', { value: text === '' ? '–' : text })}
        testID="answer-field"
      >
        <Text style={[styles.value, text === '' && styles.placeholder]}>
          {text === '' ? EMPTY : text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  equals: { ...typography.headline, fontSize: 40, lineHeight: 44, color: colors.inkFaint },
  sign: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.nightRaised,
  },
  signLabel: { ...typography.headline, fontSize: 26, lineHeight: 30, color: colors.white },
  field: {
    minWidth: 150,
    height: sizes.answerField,
    paddingHorizontal: space.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg + 2,
    backgroundColor: colors.white,
  },
  fieldCompact: { height: sizes.answerField - 14 },
  value: { ...typography.question, color: colors.ink },
  placeholder: { color: colors.placeholder },
});
