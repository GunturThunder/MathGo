import { useMutation } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../../api';
import { meQueryKey, queryClient } from '../../api/queries';
import { formatClock } from '../../battle/battle-view';
import { Button } from '../../components/Button';
import { OnboardingScreen } from '../../components/onboarding/Screen';
import { useNow } from '../../lib/use-now';
import { startErrorText, untilText } from '../../profile/consent-errors';
import { consentFlow } from '../../profile/consent-flow';
import { profile } from '../../profile/store';
import { colors, radii, sizes, space, typography } from '../../theme';

const CODE_LENGTH = 6;

/** Where the code stands after the last try (POST /consent/verify, S5-05). */
type CodeState =
  | { readonly kind: 'typing' }
  | { readonly kind: 'wrong'; readonly attemptsLeft: number }
  | { readonly kind: 'blocked'; readonly retryAt: string | undefined }
  | { readonly kind: 'expired' }
  | { readonly kind: 'gone' };

function stateFrom(error: unknown): CodeState | null {
  if (!(error instanceof ApiError)) return null;
  switch (error.code) {
    case 'wrong-code':
      return { kind: 'wrong', attemptsLeft: error.details.attemptsLeft ?? 0 };
    case 'code-locked':
      return { kind: 'blocked', retryAt: error.details.retryAt };
    case 'code-expired':
      return { kind: 'expired' };
    case 'consent-not-found':
      return { kind: 'gone' };
    default:
      return null;
  }
}

/**
 * Parent consent, step 2 (S5-09, design: 17 Parent code). Six boxes over one hidden field; the
 * code works 5 minutes; the 6th wrong code blocks it for 15 minutes; "Resend" opens after a
 * minute. The right code creates the child's account with online play unlocked.
 */
export default function ParentCode() {
  const { t } = useTranslation();
  const now = useNow();
  const input = useRef<TextInput>(null);
  const [flow, setFlow] = useState(consentFlow.get());
  const [code, setCode] = useState('');
  const [state, setState] = useState<CodeState>({ kind: 'typing' });
  const [resent, setResent] = useState(false);

  const verify = useMutation({
    mutationFn: (consentId: string) => api.verifyConsent(consentId, code),
    onSuccess: (session) => {
      queryClient.setQueryData(meQueryKey, session.user);
      consentFlow.clear();
      router.replace('/parent/done');
    },
    onError: (error) => {
      const next = stateFrom(error);
      if (next !== null) {
        setState(next);
        setCode('');
      }
    },
  });

  const resend = useMutation({
    mutationFn: async (email: string) => {
      const { birthYear } = profile.get();
      if (birthYear === null) throw new Error('no birth year');
      return { email, started: await api.startConsent(email, birthYear) };
    },
    onSuccess: (next) => {
      consentFlow.set(next);
      setFlow(next);
      setCode('');
      setState({ kind: 'typing' });
      setResent(true);
      input.current?.focus();
    },
  });

  // Opened without a code on its way (e.g. the app restarted): start from the email.
  if (flow === null) return <Redirect href="/parent/email" />;

  const expiresIn = Date.parse(flow.started.expiresAt) - now;
  const shown: CodeState = state.kind === 'typing' && expiresIn <= 0 ? { kind: 'expired' } : state;
  const blockedUntil =
    shown.kind === 'blocked' && shown.retryAt !== undefined ? Date.parse(shown.retryAt) : 0;
  const resendAt = Math.max(Date.parse(flow.started.resendAt), blockedUntil);
  const canResend = now >= resendAt && !resend.isPending;
  const canUnlock =
    code.length === CODE_LENGTH && (shown.kind === 'typing' || shown.kind === 'wrong');

  const ring = (i: number) =>
    shown.kind === 'wrong'
      ? styles.boxWrong
      : i === code.length && shown.kind === 'typing'
        ? styles.boxActive
        : i < code.length
          ? styles.boxFilled
          : null;

  return (
    <OnboardingScreen
      testID="parent-code"
      badge={t('parent.badge')}
      title={t('parent.codeTitle')}
      subtitle={t('parent.codeSubtitle', { email: flow.started.email })}
      onBack={() => router.back()}
      footer={
        <Button
          label={t('parent.unlock')}
          onPress={() => verify.mutate(flow.started.consentId)}
          disabled={!canUnlock}
          busy={verify.isPending}
          testID="parent-unlock"
        />
      }
    >
      <View>
        <View style={styles.boxes} importantForAccessibility="no-hide-descendants">
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <View key={i} style={[styles.box, ring(i)]}>
              <Text style={styles.digit}>{code[i] ?? ''}</Text>
            </View>
          ))}
        </View>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(text) => {
            setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH));
            setResent(false);
          }}
          editable={shown.kind === 'typing' || shown.kind === 'wrong'}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={CODE_LENGTH}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoFocus
          caretHidden
          accessibilityLabel={t('parent.codeLabel')}
          style={styles.hiddenInput}
          testID="parent-code-input"
        />
      </View>

      <View accessibilityLiveRegion="polite" testID="parent-code-status">
        {shown.kind === 'typing' ? (
          <Text style={styles.hint}>
            {resent ? t('parent.resent') : t('parent.codeTimer', { time: formatClock(expiresIn) })}
          </Text>
        ) : shown.kind === 'wrong' ? (
          <Text style={styles.wrong} accessibilityRole="alert">
            {t('parent.wrong', { count: shown.attemptsLeft })}
          </Text>
        ) : shown.kind === 'blocked' ? (
          <View style={styles.blocked} accessibilityRole="alert">
            <Text style={styles.blockedTitle}>{t('parent.blockedTitle')}</Text>
            <Text style={styles.blockedText}>
              {t('parent.blockedText', { time: untilText(shown.retryAt, now) })}
            </Text>
          </View>
        ) : (
          <Text style={styles.wrong} accessibilityRole="alert">
            {shown.kind === 'expired' ? t('parent.expired') : t('parent.notFound')}
          </Text>
        )}
      </View>

      <View style={styles.resendCard}>
        <View style={styles.resendText}>
          <Text style={styles.resendTitle}>{t('parent.didntGet')}</Text>
          <Text style={styles.resendNote}>
            {canResend
              ? t('parent.resendNow')
              : t('parent.resendIn', { time: formatClock(resendAt - now) })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canResend }}
          disabled={!canResend}
          onPress={() => resend.mutate(flow.email)}
          style={[styles.resend, !canResend && styles.off]}
          testID="parent-resend"
        >
          <Text style={styles.resendLabel}>{t('parent.resend')}</Text>
        </Pressable>
      </View>
      {resend.isError ? (
        <Text style={styles.wrong} accessibilityLiveRegion="polite" testID="parent-resend-error">
          {startErrorText(resend.error, now, t)}
        </Text>
      ) : verify.isError && stateFrom(verify.error) === null ? (
        <Text style={styles.wrong} accessibilityLiveRegion="polite" testID="parent-verify-error">
          {t('parent.offline')}
        </Text>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: space.sm },
  box: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md + 2,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  boxFilled: { borderColor: colors.keyDeleteBase },
  boxActive: { borderWidth: 3, borderColor: colors.blue },
  boxWrong: { borderWidth: 3, borderColor: colors.danger },
  digit: { ...typography.stat, fontSize: 30, lineHeight: 36, color: colors.ink },
  hiddenInput: { ...StyleSheet.absoluteFill, opacity: 0.01, color: colors.white },
  hint: { ...typography.caption, fontFamily: typography.label.fontFamily, color: colors.ink2 },
  wrong: { ...typography.caption, fontFamily: typography.label.fontFamily, color: colors.danger },
  blocked: {
    gap: space.xs,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: radii.xl - 2,
    backgroundColor: colors.peach,
  },
  blockedTitle: { ...typography.body, fontFamily: typography.label.fontFamily, color: colors.ink },
  blockedText: { ...typography.caption, color: colors.ink2 },
  resendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: radii.card - 2,
    backgroundColor: colors.white,
    boxShadow: `0 12px 28px ${colors.shadow}`,
  },
  resendText: { flex: 1 },
  resendTitle: { ...typography.body, fontFamily: typography.label.fontFamily, color: colors.ink },
  resendNote: { ...typography.caption, color: colors.ink2 },
  resend: {
    height: sizes.touch,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: sizes.touch / 2,
    backgroundColor: colors.surfaceSoft,
  },
  resendLabel: {
    ...typography.body,
    fontSize: 14,
    fontFamily: typography.label.fontFamily,
    color: colors.blue,
  },
  off: { opacity: 0.5 },
});
