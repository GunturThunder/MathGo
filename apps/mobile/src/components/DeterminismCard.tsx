import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { describeResult, runDeterminismCheck } from '../lib/determinism-check';

/** Shows the S1-08 check: game-core in this engine gives the same questions as in Node. */
export function DeterminismCard() {
  const result = useMemo(runDeterminismCheck, []);

  useEffect(() => {
    // Read from logcat (`adb logcat -s ReactNativeJS`) or the Metro terminal.
    console.log(describeResult(result));
  }, [result]);

  return (
    <View style={styles.card} testID="determinism-card">
      <Text style={styles.title}>game-core check (S1-08)</Text>
      <Text testID="determinism-status" style={result.passed ? styles.pass : styles.fail}>
        {result.passed ? 'PASS' : 'FAIL'}
      </Text>
      <Text>Engine: {result.engine === 'hermes' ? 'Hermes' : 'not Hermes'}</Text>
      <Text>Seed: {result.seed}</Text>
      <Text>Expected: {result.expected}</Text>
      <Text>Actual: {result.actual}</Text>
      <Text>First question: {result.firstQuestion}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' },
  title: { fontWeight: '600' },
  pass: { fontSize: 24, fontWeight: '700', color: '#1a7f37' },
  fail: { fontSize: 24, fontWeight: '700', color: '#cf222e' },
});
