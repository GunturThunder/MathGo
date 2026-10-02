import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../api';
import { meQueryKey, queryClient } from '../../api/queries';
import { Button } from '../../components/Button';
import { ArrowIcon, DiceIcon, ShieldIcon } from '../../components/icons';
import { OnboardingScreen } from '../../components/onboarding/Screen';
import { ShapeFighter } from '../../components/ShapeFighter';
import { finishOnboarding } from '../../profile/finish-onboarding';
import { profile } from '../../profile/store';
import { colors, radii, shapes, space, typography } from '../../theme';

/**
 * First launch, step 3 for adults (design: 02 Battle name, without the starting-level pick,
 * FR-10, which is P1). Names come from the server's generator: no typed names (PRD). "Let's Go!"
 * creates the guest account and saves the name, then opens Home.
 */
export default function BattleName() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'id';
  const [index, setIndex] = useState(0);
  const names = useQuery({
    queryKey: ['nicknames', lang],
    queryFn: () => api.nicknames(lang).then((r) => r.nicknames),
    staleTime: Infinity,
    // Offline, say so at once: the screen has its own Try again.
    retry: false,
  });
  const choices = names.data ?? [];
  const name = choices.length > 0 ? choices[index % choices.length] : undefined;

  const reroll = () => {
    if (index + 1 < choices.length) setIndex(index + 1);
    else {
      setIndex(0);
      void names.refetch();
    }
  };

  const signUp = useMutation({
    mutationFn: async (nickname: string) => {
      const birthYear = profile.get().birthYear;
      if (birthYear === null) throw new Error('no birth year');
      if (api.session === null) await api.signUpGuest(birthYear);
      return api.setNickname(nickname);
    },
    onSuccess: (me) => {
      queryClient.setQueryData(meQueryKey, me);
      finishOnboarding();
    },
  });

  const failed = names.isError || signUp.isError;
  return (
    <OnboardingScreen
      testID="onboarding-name"
      title={t('onboarding.nameTitle')}
      subtitle={t('onboarding.nameSubtitle')}
      onBack={() => router.back()}
      footer={
        failed ? (
          <>
            <Button
              label={t('onboarding.retry')}
              onPress={() => (names.isError ? void names.refetch() : name && signUp.mutate(name))}
              testID="onboarding-retry"
            />
            <Button
              label={t('onboarding.skip')}
              variant="secondary"
              onPress={finishOnboarding}
              testID="onboarding-skip"
            />
          </>
        ) : (
          <Button
            label={t('onboarding.go')}
            icon={<ArrowIcon color={colors.white} />}
            onPress={() => name && signUp.mutate(name)}
            disabled={name === undefined}
            busy={signUp.isPending}
            testID="onboarding-go"
          />
        )
      }
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.tile}>
            <ShapeFighter shape="triangle" size={60} />
          </View>
          <View style={styles.nameBox}>
            <Text style={styles.label}>{t('onboarding.nameLabel')}</Text>
            <Text style={styles.name} numberOfLines={1} testID="onboarding-nickname">
              {name ?? t('onboarding.loading')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.reroll')}
            disabled={choices.length === 0 || signUp.isPending}
            onPress={reroll}
            style={styles.reroll}
            testID="onboarding-reroll"
          >
            <DiceIcon color={colors.blue} />
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.note}>
          <ShieldIcon color={colors.success} />
          <Text style={styles.noteText}>{t('onboarding.nameNote')}</Text>
        </View>
      </View>
      {failed ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" testID="onboarding-error">
          {t('onboarding.offline')}
        </Text>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md + 2,
    padding: space.lg,
    borderRadius: radii.card - 2,
    backgroundColor: colors.white,
    boxShadow: `0 12px 28px ${colors.shadow}`,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2 },
  tile: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: shapes.triangle.tile,
  },
  nameBox: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...typography.label, color: colors.ink2 },
  name: { ...typography.cardTitle, fontSize: 25, lineHeight: 30, color: colors.ink },
  reroll: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg - 2,
    backgroundColor: colors.ground,
  },
  divider: { height: 1, backgroundColor: colors.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  noteText: { ...typography.caption, flex: 1, color: colors.ink2 },
  error: { ...typography.body, color: colors.danger },
});
