import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, space, typography } from '../../theme';
import { BackIcon } from '../icons';

/** First-launch screens (design: boards 02, 13, 14): back, title, subtitle, body, one action. */
export function OnboardingScreen({
  title,
  subtitle,
  onBack,
  footer,
  children,
  testID,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  /** Pinned under the content: the screen's main button. */
  footer: ReactNode;
  children?: ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen} testID={testID}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.top}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.back')}
              onPress={onBack}
              style={styles.back}
              testID="onboarding-back"
            >
              <BackIcon color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xxl }]}>{footer}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { gap: space.lg, paddingHorizontal: space.xl, paddingBottom: space.lg },
  top: { height: 52 },
  back: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg - 2,
    backgroundColor: colors.white,
    boxShadow: `0 8px 20px ${colors.shadow}`,
  },
  heading: { gap: space.xs + 2, marginTop: space.xs },
  title: { ...typography.headline, color: colors.ink },
  subtitle: { ...typography.body, color: colors.ink2 },
  footer: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.sm },
});
