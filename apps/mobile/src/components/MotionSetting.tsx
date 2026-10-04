import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { reduceMotion, useReduceMotion, useReduceMotionInSystem } from '../motion/reduce-motion';
import { colors, radii, space, typography } from '../theme';

/**
 * Settings: Reduce Motion (GF-01; WCAG 2.3.3). Turns off shake, flights and idle loops. When the
 * phone's own Reduce Motion is on, the switch shows on and can't be turned off here.
 */
export function MotionSetting() {
  const { t } = useTranslation();
  const on = useReduceMotion();
  const bySystem = useReduceMotionInSystem();
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t('settings.motion')}</Text>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label} nativeID="reduce-motion-label">
            {t('settings.reduceMotion')}
          </Text>
          <Text style={styles.note}>
            {bySystem ? t('settings.reduceMotionSystem') : t('settings.reduceMotionNote')}
          </Text>
        </View>
        <Switch
          value={on}
          disabled={bySystem}
          onValueChange={(value) => reduceMotion.setInApp(value)}
          trackColor={{ false: colors.line, true: colors.blue }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.line}
          accessibilityLabelledBy="reduce-motion-label"
          accessibilityLabel={t('settings.reduceMotion')}
          testID="settings-reduce-motion"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  heading: { ...typography.cardTitle, color: colors.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  text: { flex: 1, gap: space.xxs },
  label: { ...typography.bodyLarge, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
