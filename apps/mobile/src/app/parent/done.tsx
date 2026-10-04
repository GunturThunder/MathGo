import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { unlockFeedback } from '../../battle/haptics';
import { Button } from '../../components/Button';
import { CheckIcon } from '../../components/icons';
import { OnboardingScreen } from '../../components/onboarding/Screen';
import { colors, shapes } from '../../theme';

/** The design's star burst behind the tick (board 18). */
const BURST =
  '45,5 54.3,16.4 69.9,10.8 66.5,29.4 88.6,30.8 73.2,45 85.6,58.2 68.7,62.2 72,82.2 53.7,71.8 45,90.5 36.1,72.3 17.7,82.6 23.4,60.7 4.1,58.3 16,45 1.7,30.9 24.2,29.9 18.3,8.2 36.4,18.5';

/**
 * Parent consent, done (S5-09, design: 18 Unlocked). The child has an account with online play
 * unlocked; next they pick a battle name (decided Oct 1, 2026: only after the unlock).
 */
export default function ParentDone() {
  const { t } = useTranslation();
  useEffect(() => unlockFeedback(), []);
  return (
    <OnboardingScreen
      testID="parent-done"
      title={t('parent.doneTitle')}
      subtitle={t('parent.doneText')}
      footer={
        <Button
          label={t('parent.go')}
          onPress={() => router.replace('/onboarding/name')}
          testID="parent-go"
        />
      }
    >
      <View style={styles.art} importantForAccessibility="no-hide-descendants">
        <Svg width={170} height={170} viewBox="0 0 90 92" style={StyleSheet.absoluteFill}>
          <Polygon
            points={BURST}
            fill={colors.hit}
            stroke={colors.white}
            strokeWidth={4}
            strokeLinejoin="round"
          />
        </Svg>
        <View style={styles.tick}>
          <CheckIcon color={colors.white} size={40} />
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  art: {
    alignSelf: 'center',
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  tick: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    backgroundColor: shapes.hexagon.face,
    boxShadow: `0 6px 0 ${shapes.hexagon.base}`,
  },
});
