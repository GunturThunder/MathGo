import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, space, typography } from '../../theme';
import { BackIcon } from '../icons';

/**
 * First-launch and parent screens (design: boards 02, 13–18): back, an optional badge, title,
 * subtitle, body, and the actions pinned below.
 */
export function OnboardingScreen({
  badge,
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
  /** A small pill above the title, e.g. "FOR PARENTS" (boards 16, 17). */
  badge?: string;
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
          {badge === undefined ? null : (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
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
  badge: {
    alignSelf: 'flex-start',
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: space.md - 2,
    marginBottom: space.xxs,
    borderRadius: 13,
    backgroundColor: colors.violet,
  },
  badgeText: { ...typography.label, color: colors.white },
  title: { ...typography.headline, color: colors.ink },
  subtitle: { ...typography.body, color: colors.ink2 },
  footer: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.sm },
});
