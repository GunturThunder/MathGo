import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMe } from '../api/queries';
import { EMPTY_ENTRY, entryValue, pressKey, type KeypadKey } from '../battle/answer-entry';
import type { BattleSummary } from '../battle/battle-result';
import {
  currentQuestion,
  onlineSummary,
  onlineView,
  preStart,
  rivalAwaySeconds,
} from '../battle/online';
import {
  RECONNECT_WINDOW_MS,
  useOnlineBattle,
  type BattleSource,
} from '../battle/use-online-battle';
import { Button } from '../components/Button';
import { BattleScreen } from '../components/battle/BattleScreen';
import { CreateRoom } from '../components/battle/CreateRoom';
import {
  PreStartOverlay,
  ReconnectingOverlay,
  RivalAwayBanner,
} from '../components/battle/OnlineStates';
import { ResultScreen } from '../components/battle/ResultScreen';
import { errorText } from '../lib/server-errors';
import { updateRequired } from '../net/update-required';
import { onlineLocked } from '../profile/online';
import { colors, space, typography } from '../theme';

/** Shown while the next question is on its way from the server. */
const WAITING = '…';

/**
 * A random online battle (S3-12): the same battle screen as practice, fed by the server. The
 * matchmaking screen (S5-07) and the versus screen come later; this shows a simple search.
 */
export default function Battle() {
  // Online battles are locked under 18 without a parent's consent (S3-09).
  if (onlineLocked()) return <Redirect href="/ask-parent" />;
  // This version was refused by the server (S4-12).
  if (updateRequired()) return <Redirect href="/update-required" />;
  return <OnlineBattle />;
}

/** `/battle` (random), `/battle?mode=create` (open a room, S4-08), `/battle?mode=join&room=ID` (S4-09). */
function sourceFrom(mode: string | undefined, room: string | undefined): BattleSource {
  if (mode === 'create') return { kind: 'create' };
  if (mode === 'join' && room) return { kind: 'join', roomId: room };
  return { kind: 'random' };
}

function OnlineBattle() {
  const { t } = useTranslation();
  const me = useMe();
  const params = useLocalSearchParams<{ mode?: string; room?: string }>();
  const source = useMemo(() => sourceFrom(params.mode, params.room), [params.mode, params.room]);
  const friendly = source.kind !== 'random';
  const online = useOnlineBattle(source);
  const [entry, setEntry] = useState(EMPTY_ENTRY);
  const [summary, setSummary] = useState<BattleSummary | null>(null);
  const fighters = useMemo(
    () => ({
      me: { name: me.data?.nickname ?? t('practice.you'), trophies: me.data?.trophies ?? null },
      rival: { name: t('online.rival'), trophies: null },
    }),
    [me.data, t],
  );
  const arena = online.battle.arena ?? 1;
  const onKey = useCallback((key: KeypadKey) => setEntry((e) => pressKey(e, key, arena)), [arena]);

  // A version refused mid-session (server updated): the update screen explains.
  useEffect(() => {
    if (online.error === 'update-required') router.replace('/update-required');
  }, [online.error]);

  const playAgain = () => {
    setSummary(null);
    setEntry(EMPTY_ENTRY);
    online.again();
  };
  const home = () => {
    void online.leave();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (summary !== null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <ResultScreen
          summary={summary}
          modeLabel={friendly ? t('online.modeFriend') : t('online.modeRanked')}
          // Play again in a friend's room is the rematch (S4-13); random battles search again.
          {...(friendly ? {} : { onPlayAgain: playAgain })}
          onHome={home}
        />
      </>
    );
  }

  const view = onlineView(online.battle, fighters, online.now);
  if (online.phase === 'battle' && view !== null) {
    const question = currentQuestion(online.battle);
    const before = preStart(online.battle, online.now);
    const away = rivalAwaySeconds(online.battle, online.now);
    const overlay =
      online.reconnectSecondsLeft !== null ? (
        <ReconnectingOverlay
          secondsLeft={online.reconnectSecondsLeft}
          windowSeconds={RECONNECT_WINDOW_MS / 1000}
          onLeave={home}
        />
      ) : before !== null ? (
        <PreStartOverlay countdown={before.kind === 'countdown' ? before.n : null} />
      ) : null;
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <BattleScreen
          view={view}
          question={question?.text ?? WAITING}
          entry={entry}
          onKey={onKey}
          onSubmit={() => {
            const value = entryValue(entry);
            if (value === null) return;
            online.submit(value);
            setEntry(EMPTY_ENTRY);
          }}
          onQuit={home}
          effects={online.effects}
          onSeeResults={() => setSummary(onlineSummary(online.battle, fighters))}
          {...(friendly ? {} : { onPlayAgain: playAgain })}
          banner={
            away === null ? null : <RivalAwayBanner name={fighters.rival.name} secondsLeft={away} />
          }
          overlay={overlay}
        />
        {__DEV__ && before === null && online.reconnectSecondsLeft === null ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => online.devDrop(5_000)}
            style={styles.devDrop}
            testID="dev-drop"
          >
            <Text style={styles.devDropText}>{t('onlineStates.dropDev')}</Text>
          </Pressable>
        ) : null}
      </>
    );
  }

  // A room of our own, before the friend arrives (S4-08).
  if (source.kind === 'create' && online.phase !== 'error') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <CreateRoom code={online.invite?.code ?? null} onBack={home} />
      </>
    );
  }

  return (
    <View
      style={styles.screen}
      testID={online.phase === 'error' ? 'online-error' : 'online-searching'}
    >
      {online.phase === 'error' && online.error !== null ? (
        <>
          <Text style={styles.title}>{t('online.failedTitle')}</Text>
          <Text style={styles.text}>
            {online.error === 'connection-failed'
              ? t('online.connectionFailed')
              : online.error === 'connection-lost'
                ? t('online.connectionLost')
                : errorText(online.error, t)}
          </Text>
          <View style={styles.buttons}>
            <Button label={t('onboarding.retry')} onPress={playAgain} testID="online-retry" />
            <Button
              label={t('result.home')}
              variant="secondary"
              onPress={home}
              testID="online-home"
            />
          </View>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.blue} />
          <Text style={styles.title}>
            {source.kind === 'join' ? t('join.joining') : t('online.searching')}
          </Text>
          {source.kind === 'join' ? null : (
            <Text style={styles.text}>{t('online.searchingNote')}</Text>
          )}
          <View style={styles.buttons}>
            <Button
              label={t('online.cancel')}
              variant="secondary"
              onPress={home}
              testID="online-cancel"
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xxl,
    backgroundColor: colors.ground,
  },
  title: { ...typography.headline, color: colors.ink, textAlign: 'center' },
  text: { ...typography.body, color: colors.ink2, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', gap: space.md, marginTop: space.xl },
  devDrop: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    padding: space.xs,
    borderRadius: 8,
    backgroundColor: colors.peach,
  },
  devDropText: { ...typography.caption, fontSize: 11, color: colors.orangeDeep },
});
