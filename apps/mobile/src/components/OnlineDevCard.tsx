import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
          <Text>{t('online.signedOut')}</Text>
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
          <Text testID="online-nickname">
            {t('online.nickname', { value: me.data?.nickname ?? session.user.nickname })}
          </Text>
          <Text>
            {t('online.status', {
              value: (me.data ?? session.user).online ? t('online.yes') : t('online.no'),
            })}
          </Text>
          <Text>
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
