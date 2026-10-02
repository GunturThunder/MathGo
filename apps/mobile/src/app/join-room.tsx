import { JoinError } from '@mathgo/battle-client';
import * as Clipboard from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { INVITE_CODE_LENGTH, cleanCode, codeFrom } from '../battle/invite-code';
import { Button } from '../components/Button';
import { OnboardingScreen } from '../components/onboarding/Screen';
import { findInviteAsPlayer } from '../net/battle';
import { updateRequired } from '../net/update-required';
import { onlineLocked } from '../profile/online';
import { colors, radii, space, typography } from '../theme';

type Lookup =
  | { readonly state: 'idle' | 'looking' }
  | { readonly state: 'found'; readonly roomId: string }
  | { readonly state: 'missing' | 'expired' | 'offline' };

/**
 * Join a friend's room by code (S4-09, design: 09 Join with code). The room is looked up as
 * soon as 6 characters are in; a code on the clipboard is offered as "Paste". From Home that's
 * three taps: Join with code, Paste, Join battle.
 */
export default function JoinRoom() {
  if (onlineLocked()) return <Redirect href="/ask-parent" />;
  if (updateRequired()) return <Redirect href="/update-required" />;
  return <JoinRoomForm />;
}

function JoinRoomForm() {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [lookAlike, setLookAlike] = useState(false);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const input = useRef<TextInput>(null);

  // A code copied from WhatsApp is offered as one tap.
  useEffect(() => {
    void (async () => {
      if (!(await Clipboard.hasStringAsync())) return;
      setSuggested(codeFrom(await Clipboard.getStringAsync()));
    })();
  }, []);

  useEffect(() => {
    if (code.length < INVITE_CODE_LENGTH) {
      setLookup({ state: 'idle' });
      return;
    }
    let current = true;
    setLookup({ state: 'looking' });
    findInviteAsPlayer(code).then(
      ({ roomId }) => current && setLookup({ state: 'found', roomId }),
      (e: unknown) => {
        if (!current) return;
        const reason = e instanceof JoinError ? e.code : 'connection-failed';
        setLookup({
          state:
            reason === 'room-expired'
              ? 'expired'
              : reason === 'room-not-found'
                ? 'missing'
                : 'offline',
        });
      },
    );
    return () => {
      current = false;
    };
  }, [code]);

  const type = (raw: string) => {
    const clean = cleanCode(raw);
    setCode(clean.code);
    setLookAlike(clean.lookAlike);
  };

  return (
    <OnboardingScreen
      testID="join-room"
      title={t('join.title')}
      subtitle={t('join.subtitle')}
      onBack={() => router.back()}
      footer={
        <Button
          label={t('join.join')}
          variant="battle"
          disabled={lookup.state !== 'found'}
          onPress={() =>
            lookup.state === 'found' && router.replace(`/battle?mode=join&room=${lookup.roomId}`)
          }
          testID="join-battle"
        />
      }
    >
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <View style={styles.tiles}>
          {Array.from({ length: INVITE_CODE_LENGTH }, (_, i) => {
            const active = i === code.length;
            return (
              <View
                key={i}
                style={[
                  styles.tile,
                  code[i] ? styles.tileFilled : null,
                  active && styles.tileActive,
                ]}
              >
                <Text style={styles.tileText}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={input}
          value={code}
          onChangeText={type}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          autoFocus
          maxLength={INVITE_CODE_LENGTH + 4}
          accessibilityLabel={t('join.codeLabel')}
          style={styles.hidden}
          testID="join-code-input"
        />
      </Pressable>
      <View style={styles.row}>
        {suggested !== null && suggested !== code ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => type(suggested)}
            style={styles.chip}
            testID="join-paste"
          >
            <Text style={styles.chipText}>{t('join.paste', { code: suggested })}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {code.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => type('')}
            style={styles.clear}
            testID="join-clear"
          >
            <Text style={styles.clearText}>{t('join.clear')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.hint, lookAlike && styles.hintBad]} testID="join-hint">
        {t('join.noLookAlikes')}
      </Text>
      <View style={styles.status} accessibilityLiveRegion="polite" testID="join-status">
        {lookup.state === 'found' ? (
          <>
            <Text style={[styles.statusTitle, styles.found]}>{t('join.found')}</Text>
            <Text style={styles.statusNote}>{t('join.foundNote')}</Text>
          </>
        ) : lookup.state === 'missing' || lookup.state === 'expired' ? (
          <>
            <Text style={styles.statusTitle}>
              {t(lookup.state === 'expired' ? 'join.expired' : 'join.missing')}
            </Text>
            <Text style={styles.statusNote}>{t('join.missingNote')}</Text>
          </>
        ) : lookup.state === 'offline' ? (
          <Text style={styles.statusNote}>{t('online.connectionFailed')}</Text>
        ) : (
          <Text style={styles.statusNote}>
            {lookup.state === 'looking' ? t('join.looking') : t('join.enterAll')}
          </Text>
        )}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: {
    width: '15%',
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  tileFilled: { borderColor: colors.white, boxShadow: `0 4px 0 ${colors.keyBase}` },
  tileActive: { borderColor: colors.blue },
  tileText: { ...typography.headline, fontSize: 30, lineHeight: 36, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: 22,
    backgroundColor: colors.sky,
  },
  chipText: { ...typography.body, fontFamily: typography.label.fontFamily, color: colors.blueBase },
  clear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md },
  clearText: { ...typography.body, color: colors.ink2 },
  hint: { ...typography.caption, color: colors.ink2 },
  hintBad: { color: colors.danger },
  status: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
  },
  statusTitle: { ...typography.cardTitle, color: colors.ink },
  found: { color: colors.success },
  statusNote: { ...typography.caption, color: colors.ink2 },
});
