import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, sizes, space, typography } from '../theme';
import { api } from '../api';
import { meQueryKey, useMe } from '../api/queries';

/**
 * Dev builds only: sign in as a guest without the first-launch flow (S3-08), to check that the
 * session survives a restart and refreshes on its own (S3-10).
 */
export function OnlineDevCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useMe();
  const refreshMe = () => queryClient.invalidateQueries({ queryKey: meQueryKey });
  const signUp = useMutation({ mutationFn: () => api.signUpGuest(2000), onSuccess: refreshMe });
  const session = api.session;
  const error = me.error ?? signUp.error;

  return (
    <View style={styles.card} testID="online-dev-card">
      <Text style={styles.title}>{t('online.title')}</Text>
      {session === null ? (
        <>
          <Text style={styles.body}>{t('online.signedOut')}</Text>
          <Pressable
            style={styles.button}
            onPress={() => signUp.mutate()}
            testID="online-create-guest"
          >
            <Text style={styles.buttonLabel}>{t('online.createGuest')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text testID="online-nickname" style={styles.body}>
            {t('online.nickname', { value: me.data?.nickname ?? session.user.nickname })}
          </Text>
          <Text style={styles.body}>
            {t('online.status', {
              value: (me.data ?? session.user).online ? t('online.yes') : t('online.no'),
            })}
          </Text>
          <Text style={styles.body}>
            {t('online.expires', {
              value: new Date(session.accessTokenExpiresAt).toLocaleTimeString(),
            })}
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              api.signOut();
              queryClient.removeQueries({ queryKey: meQueryKey });
              signUp.reset();
            }}
          >
            <Text style={styles.buttonLabel}>{t('online.clear')}</Text>
          </Pressable>
        </>
      )}
      {error === null ? null : (
        <Text style={styles.error}>{t('online.error', { value: error.message })}</Text>
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
