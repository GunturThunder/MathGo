import { findMatch, type BattleConnection } from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, sizes, space, typography } from '../theme';
import { API_URL } from '../api';
import { router } from 'expo-router';
import { findMatchAsPlayer, GAME_SERVER_URL } from '../net/battle';
import { isUpdateRequiredError } from '../net/update-required';

type Status = 'idle' | 'joining' | 'joined' | 'dropped';

/** A throwaway guest, not stored: the second seat a test battle needs to start. */
async function opponentToken(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ birthYear: 1990 }),
  });
  if (!res.ok) throw new Error(`opponent sign-up failed (${res.status})`);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

/**
 * Dev builds only (S3-11): queues the signed-in player and a test opponent, so they meet in one
 * battle, and shows the questions that arrive. The real battle screen comes with S2-08/S3-12.
 */
export function BattleDevCard() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [inbox, setInbox] = useState<ServerMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const connections = useRef<BattleConnection[]>([]);

  const leave = async () => {
    const open = connections.current;
    connections.current = [];
    await Promise.allSettled(open.map((c) => c.leave()));
    setStatus('idle');
  };
  useEffect(() => () => void leave(), []);

  const join = async () => {
    setStatus('joining');
    setError(null);
    setInbox([]);
    try {
      // Both search the random queue (FR-02), like real players, and meet in one battle.
      const mine = await findMatchAsPlayer({
        onMessage: (m) => setInbox((list) => [...list, m]),
        onDrop: () => setStatus('dropped'),
        onReconnect: () => setStatus('joined'),
        onLeave: () => setStatus('idle'),
      });
      const token = await opponentToken();
      const theirs = await findMatch(
        { endpoint: GAME_SERVER_URL, getToken: async () => token },
        { onMessage: () => undefined },
      );
      connections.current.push(...(await Promise.all([mine.match, theirs.match])));
      setStatus('joined');
    } catch (e) {
      await leave();
      // An old app: the update screen says what to do (S4-12).
      if (isUpdateRequiredError(e)) {
        router.push('/update-required');
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const joined = inbox.find((m) => m.type === 'joined');
  const questions = inbox.flatMap((m) => (m.type === 'questions' ? m.payload.questions : []));

  return (
    <View style={styles.card} testID="battle-dev-card">
      <Text style={styles.title}>{t('battleDev.title')}</Text>
      <Text style={styles.body}>{t('battleDev.hint')}</Text>
      {status === 'idle' ? (
        <Pressable style={styles.button} onPress={() => void join()} testID="battle-dev-join">
          <Text style={styles.buttonLabel}>{t('battleDev.join')}</Text>
        </Pressable>
      ) : null}
      {status === 'joining' ? <Text style={styles.body}>{t('battleDev.joining')}</Text> : null}
      {status === 'dropped' ? <Text style={styles.body}>{t('battleDev.dropped')}</Text> : null}
      {joined?.type === 'joined' ? (
        <Text style={styles.body}>{t('battleDev.seat', { value: joined.payload.seat })}</Text>
      ) : null}
      {status !== 'idle' ? (
        <>
          <Text testID="battle-dev-count" style={styles.body}>
            {t('battleDev.questions', { value: questions.length })}
          </Text>
          {questions[0] === undefined ? null : (
            <Text style={styles.body}>{t('battleDev.first', { value: questions[0].text })}</Text>
          )}
          <Pressable style={styles.button} onPress={() => void leave()}>
            <Text style={styles.buttonLabel}>{t('battleDev.leave')}</Text>
          </Pressable>
        </>
      ) : null}
      {error === null ? null : (
        <Text style={styles.error}>{t('battleDev.error', { value: error })}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  title: { ...typography.cardTitle, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  button: {
    marginTop: space.xs,
    minHeight: sizes.touch,
    justifyContent: 'center',
    padding: space.md,
    borderRadius: radii.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    ...shadows.raised(colors.blueBase, 4),
  },
  buttonLabel: { ...typography.button, color: colors.white },
  error: { ...typography.body, color: colors.danger },
});
