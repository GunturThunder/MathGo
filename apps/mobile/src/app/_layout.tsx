import '../i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { queryClient } from '../api/queries';
import { colors, typography, useAppFonts } from '../theme';

export default function RootLayout() {
  const { t } = useTranslation();
  // Nothing to show until the design's fonts are in (a few ms, they ship in the app).
  if (!useAppFonts()) return null;
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.ground },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: typography.cardTitle.fontFamily },
          contentStyle: { backgroundColor: colors.ground },
        }}
      >
        <Stack.Screen name="index" options={{ title: t('app.name') }} />
        <Stack.Screen name="battle" options={{ title: t('battle.title') }} />
        <Stack.Screen name="practice" options={{ title: t('practice.title') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      </Stack>
    </QueryClientProvider>
  );
}
