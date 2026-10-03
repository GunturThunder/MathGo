import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { LockIcon } from '../components/icons';
import { OnboardingScreen } from '../components/onboarding/Screen';
import { ShapeFighter } from '../components/ShapeFighter';
import { colors, radii, shapes, space, typography } from '../theme';

const STEPS = [
  { title: 'askParent.step1', text: 'askParent.step1Text', tile: colors.lilac },
  { title: 'askParent.step2', text: 'askParent.step2Text', tile: colors.sky },
  { title: 'askParent.step3', text: 'askParent.step3Text', tile: colors.mint },
] as const;

/**
 * Under-18 mode (S3-09, design: 15 Ask a parent). Every way into online play leads here for a
 * player under 18 without consent. Practice vs bot works right away; "Ask a Parent" starts the
 * parent's email code (S5-09).
 */
export default function AskParent() {
  const { t } = useTranslation();
  return (
    <OnboardingScreen
      testID="ask-parent"
      title={t('askParent.title')}
      subtitle={t('askParent.subtitle')}
      onBack={() => router.back()}
      footer={
        <>
          <Button
            label={t('askParent.ask')}
            variant="violet"
            onPress={() => router.push('/parent/email')}
            testID="ask-parent-ask"
          />
          <Button
            label={t('askParent.practice')}
            variant="secondary"
            onPress={() => router.replace('/practice')}
            testID="ask-parent-practice"
          />
        </>
      }
    >
      <View style={styles.art} importantForAccessibility="no-hide-descendants">
        <View style={[styles.tile, { backgroundColor: shapes.triangle.tile }]}>
          <ShapeFighter shape="triangle" size={52} />
        </View>
        <View style={styles.lock}>
          <LockIcon color={colors.white} size={26} />
        </View>
        <View style={[styles.tile, { backgroundColor: shapes.circle.tile }]}>
          <ShapeFighter shape="circle" size={50} />
        </View>
      </View>
      <View style={styles.card}>
        {STEPS.map((step, i) => (
          <View key={step.title} style={styles.step}>
            <View style={[styles.number, { backgroundColor: step.tile }]}>
              <Text style={styles.numberText}>{i + 1}</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>{t(step.title)}</Text>
              <Text style={styles.stepNote}>{t(step.text)}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  art: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md - 2 },
  tile: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 26 },
  lock: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg - 2,
    backgroundColor: colors.violet,
    boxShadow: `0 5px 0 ${colors.violetBase}`,
  },
  card: {
    gap: space.md + 2,
    paddingVertical: space.lg + 2,
    paddingHorizontal: space.lg,
    borderRadius: radii.card - 2,
    backgroundColor: colors.white,
    boxShadow: `0 12px 28px ${colors.shadow}`,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  number: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  numberText: { ...typography.cardTitle, fontSize: 19, color: colors.ink },
  stepText: { flex: 1 },
  stepTitle: { ...typography.body, fontFamily: typography.label.fontFamily, color: colors.ink },
  stepNote: { ...typography.caption, color: colors.ink2 },
});
