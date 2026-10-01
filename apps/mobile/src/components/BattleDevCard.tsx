import { joinBattle, type BattleConnection } from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { API_URL } from '../api';
import { GAME_SERVER_URL, joinAsPlayer } from '../net/battle';

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
 * Dev builds only (S3-11): joins a BattleRoom as the signed-in player, with a test opponent, and
 * shows the questions that arrive. The real battle screen comes with S2-08/S3-12.
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
      const me = await joinAsPlayer({
        onMessage: (m) => setInbox((list) => [...list, m]),
        onDrop: () => setStatus('dropped'),
        onReconnect: () => setStatus('joined'),
        onLeave: () => setStatus('idle'),
      });
      connections.current.push(me);
      const token = await opponentToken();
      const opponent = await joinBattle(
        { endpoint: GAME_SERVER_URL, getToken: async () => token },
        { onMessage: () => undefined },
        me.roomId,
      );
      connections.current.push(opponent);
      setStatus('joined');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await leave();
    }
  };

  const joined = inbox.find((m) => m.type === 'joined');
  const questions = inbox.flatMap((m) => (m.type === 'questions' ? m.payload.questions : []));

  return (
    <View style={styles.card} testID="battle-dev-card">
      <Text style={styles.title}>{t('battleDev.title')}</Text>
      <Text>{t('battleDev.hint')}</Text>
      {status === 'idle' ? (
        <Pressable style={styles.button} onPress={() => void join()} testID="battle-dev-join">
          <Text style={styles.buttonLabel}>{t('battleDev.join')}</Text>
        </Pressable>
      ) : null}
      {status === 'joining' ? <Text>{t('battleDev.joining')}</Text> : null}
      {status === 'dropped' ? <Text>{t('battleDev.dropped')}</Text> : null}
      {joined?.type === 'joined' ? (
        <Text>{t('battleDev.seat', { value: joined.payload.seat })}</Text>
      ) : null}
      {status !== 'idle' ? (
        <>
          <Text testID="battle-dev-count">
            {t('battleDev.questions', { value: questions.length })}
          </Text>
          {questions[0] === undefined ? null : (
            <Text>{t('battleDev.first', { value: questions[0].text })}</Text>
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
  card: { gap: 6, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ccc' },
  title: { fontWeight: '600' },
  button: {
    marginTop: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  buttonLabel: { color: '#fff', fontWeight: '600' },
  error: { color: '#cf222e' },
});
