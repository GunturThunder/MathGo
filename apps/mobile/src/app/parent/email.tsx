import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../api';
import { Button } from '../../components/Button';
import { CheckIcon, MailIcon, ShieldIcon } from '../../components/icons';
import { OnboardingScreen } from '../../components/onboarding/Screen';
import { startErrorText } from '../../profile/consent-errors';
import { consentFlow } from '../../profile/consent-flow';
import { profile } from '../../profile/store';
import { colors, radii, space, typography } from '../../theme';

/** One `@`, no spaces, a dot in the domain: the server checks properly (S5-05). */
const looksLikeEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(text.trim());

/**
 * Parent consent, step 1 (S5-09, design: 16 Parent email). The parent types their email and
 * agrees; a 6-digit code goes there. The address stays in memory, only to resend the code.
 */
export default function ParentEmail() {
  const { t } = useTranslation();
  const [email, setEmail] = useState(consentFlow.get()?.email ?? '');
  const [agreed, setAgreed] = useState(false);
  const send = useMutation({
    mutationFn: async () => {
      const { birthYear } = profile.get();
      if (birthYear === null) throw new Error('no birth year');
      const address = email.trim();
      const started = await api.startConsent(address, birthYear);
      return { email: address, started };
    },
    onSuccess: (flow) => {
      consentFlow.set(flow);
      router.push('/parent/code');
    },
  });

  return (
    <OnboardingScreen
      testID="parent-email"
      badge={t('parent.badge')}
      title={t('parent.emailTitle')}
      subtitle={t('parent.emailSubtitle')}
      onBack={() => router.back()}
      footer={
        <Button
          label={t('parent.send')}
          onPress={() => send.mutate()}
          disabled={!agreed || !looksLikeEmail(email)}
          busy={send.isPending}
          testID="parent-send"
        />
      }
    >
      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label} nativeID="parent-email-label">
            {t('parent.emailLabel')}
          </Text>
          <View style={styles.inputBox}>
            <MailIcon color={colors.ink2} />
            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                send.reset();
              }}
              placeholder={t('parent.emailPlaceholder')}
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              inputMode="email"
              returnKeyType="send"
              onSubmitEditing={() => agreed && looksLikeEmail(email) && send.mutate()}
              accessibilityLabelledBy="parent-email-label"
              accessibilityLabel={t('parent.emailLabel')}
              style={styles.input}
              testID="parent-email-input"
            />
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.note}>
          <ShieldIcon color={colors.success} />
          <Text style={styles.noteText}>{t('parent.emailNote')}</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        onPress={() => setAgreed(!agreed)}
        style={styles.agree}
        testID="parent-agree"
      >
        <View style={[styles.box, agreed && styles.boxOn]}>
          {agreed ? <CheckIcon color={colors.white} size={16} /> : null}
        </View>
        <Text style={styles.agreeText}>{t('parent.agree')}</Text>
      </Pressable>

      {send.isError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" testID="parent-email-error">
          {startErrorText(send.error, Date.now(), t)}
        </Text>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.lg,
    padding: space.lg,
    borderRadius: radii.card - 2,
    backgroundColor: colors.white,
    boxShadow: `0 12px 28px ${colors.shadow}`,
  },
  field: { gap: space.sm },
  label: { ...typography.label, color: colors.ink2 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 60,
    paddingHorizontal: space.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 3,
    borderColor: colors.blue,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    padding: 0,
    ...typography.bodyLarge,
    fontFamily: typography.label.fontFamily,
    color: colors.ink,
  },
  divider: { height: 1, backgroundColor: colors.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  noteText: { ...typography.caption, flex: 1, color: colors.ink2 },
  agree: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.xs,
  },
  box: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.inkFaint,
    backgroundColor: colors.white,
  },
  boxOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  agreeText: {
    ...typography.caption,
    flex: 1,
    fontFamily: typography.label.fontFamily,
    color: colors.ink,
  },
  error: { ...typography.body, color: colors.danger },
});
