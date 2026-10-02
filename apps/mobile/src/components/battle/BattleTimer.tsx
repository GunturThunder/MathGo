import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../../theme';

const SIZE = 58;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The round timer: a ring that empties over 90 s, orange in the last 10 s. */
export function BattleTimer({
  text,
  share,
  warning,
}: {
  text: string;
  share: number;
  warning: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={t('battleScreen.timeLeft', { value: text })}
      testID="battle-timer"
    >
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={colors.timerTrack}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={warning ? colors.timerWarning : colors.blue}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZE / 2,
    backgroundColor: colors.white,
    boxShadow: `0 8px 20px ${colors.shadow}`,
  },
  text: { ...typography.cardTitle, fontSize: 16, lineHeight: 20, color: colors.ink },
});
