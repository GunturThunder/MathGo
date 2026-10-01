import '../i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { queryClient } from '../api/queries';

export default function RootLayout() {
  const { t } = useTranslation();
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ title: t('app.name') }} />
        <Stack.Screen name="battle" options={{ title: t('battle.title') }} />
        <Stack.Screen name="practice" options={{ title: t('practice.title') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      </Stack>
    </QueryClientProvider>
  );
}
