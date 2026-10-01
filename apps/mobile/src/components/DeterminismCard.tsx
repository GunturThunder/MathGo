import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, space, typography } from '../theme';
import { describeResult, runDeterminismCheck } from '../lib/determinism-check';

/** Shows the S1-08 check: game-core in this engine gives the same questions as in Node. */
export function DeterminismCard() {
  const { t } = useTranslation();
  const result = useMemo(runDeterminismCheck, []);

  useEffect(() => {
    // Read from logcat (`adb logcat -s ReactNativeJS`) or the Metro terminal.
    console.log(describeResult(result));
  }, [result]);

  return (
    <View style={styles.card} testID="determinism-card">
      <Text style={styles.title}>{t('check.title')}</Text>
      <Text testID="determinism-status" style={result.passed ? styles.pass : styles.fail}>
        {result.passed ? t('check.pass') : t('check.fail')}
      </Text>
      <Text style={styles.body}>
        {result.engine === 'hermes' ? t('check.engineHermes') : t('check.engineOther')}
      </Text>
      <Text style={styles.body}>{t('check.seed', { value: result.seed })}</Text>
      <Text style={styles.body}>{t('check.expected', { value: result.expected })}</Text>
      <Text style={styles.body}>{t('check.actual', { value: result.actual })}</Text>
      <Text style={styles.body}>{t('check.firstQuestion', { value: result.firstQuestion })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  title: { ...typography.cardTitle, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  pass: { ...typography.stat, color: colors.success },
  fail: { ...typography.stat, color: colors.danger },
});
