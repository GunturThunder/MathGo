import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
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
      <Text>{result.engine === 'hermes' ? t('check.engineHermes') : t('check.engineOther')}</Text>
      <Text>{t('check.seed', { value: result.seed })}</Text>
      <Text>{t('check.expected', { value: result.expected })}</Text>
      <Text>{t('check.actual', { value: result.actual })}</Text>
      <Text>{t('check.firstQuestion', { value: result.firstQuestion })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' },
  title: { fontWeight: '600' },
  pass: { fontSize: 24, fontWeight: '700', color: '#1a7f37' },
  fail: { fontSize: 24, fontWeight: '700', color: '#cf222e' },
});
