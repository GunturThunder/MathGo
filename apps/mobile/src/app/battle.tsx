import { Redirect, router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMe } from '../api/queries';
import { EMPTY_ENTRY, entryValue, pressKey, type KeypadKey } from '../battle/answer-entry';
import type { BattleSummary } from '../battle/battle-result';
import { currentQuestion, onlineSummary, onlineView } from '../battle/online';
import { useOnlineBattle } from '../battle/use-online-battle';
import { Button } from '../components/Button';
import { BattleScreen } from '../components/battle/BattleScreen';
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

function OnlineBattle() {
  const { t } = useTranslation();
  const me = useMe();
  const online = useOnlineBattle();
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
          modeLabel={t('online.modeRanked')}
          onPlayAgain={playAgain}
          onHome={home}
        />
      </>
    );
  }

  const view = onlineView(online.battle, fighters, online.now);
  if (online.phase === 'battle' && view !== null) {
    const question = currentQuestion(online.battle);
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
          onPlayAgain={playAgain}
        />
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
          <Text style={styles.title}>{t('online.searching')}</Text>
          <Text style={styles.text}>{t('online.searchingNote')}</Text>
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
});
