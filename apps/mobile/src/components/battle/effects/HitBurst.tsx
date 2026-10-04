import { Canvas, Circle, Group, Path } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../../motion/reduce-motion';
import { colors, typography } from '../../../theme';

/** The jagged burst from the design (viewBox 90 × 92). */
const BURST =
  'M45 5L54.3 16.4L69.9 10.8L66.5 29.4L88.6 30.8L73.2 45L85.6 58.2L68.7 62.2L72 82.2L53.7 71.8L45 90.5L36.1 72.3L17.7 82.6L23.4 60.7L4.1 58.3L16 45L1.7 30.9L24.2 29.9L18.3 8.2L36.4 18.5Z';
const BOX = 120;
const BURST_SIZE = 74;
const SPARKS = 8;
export const HIT_BURST_MS = 700;

/**
 * Damage on a fighter (S2-09): a burst that pops in with the damage number, sparks flying out,
 * then fades. Skia draws it; Reanimated drives it on the UI thread. Under Reduce Motion (GF-01)
 * the burst and the number fade in and out in place, without sparks.
 */
export function HitBurst({ damage, taken }: { damage: number; taken: boolean }) {
  const reduced = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: HIT_BURST_MS, easing: Easing.out(Easing.cubic) });
  }, [t]);

  // Pop: 0–0.5 of the run, then hold; fade out over the last 30 %.
  const burstTransform = useDerivedValue(() => {
    const p = reduced ? 1 : Math.min(1, t.value / 0.5);
    const scale = interpolate(p, [0, 0.6, 1], [0.4, 1.12, 1]);
    const angle = (interpolate(p, [0, 0.6, 1], [-18, 4, 0]) * Math.PI) / 180;
    return [
      { translateX: BOX / 2 },
      { translateY: BOX / 2 },
      { rotate: angle },
      { scale: (scale * BURST_SIZE) / 90 },
      { translateX: -45 },
      { translateY: -46 },
    ];
  });
  const opacity = useDerivedValue(() => interpolate(t.value, [0, 0.1, 0.7, 1], [0, 1, 1, 0]));
  const labelStyle = useAnimatedStyle(() => {
    const p = reduced ? 1 : Math.min(1, t.value / 0.5);
    return {
      opacity: opacity.value,
      transform: [{ scale: interpolate(p, [0, 0.6, 1], [0.4, 1.12, 1]) }],
    };
  });

  return (
    <Animated.View style={styles.box} pointerEvents="none" testID="hit-burst">
      <Canvas style={styles.canvas}>
        <Group opacity={opacity}>
          {reduced
            ? null
            : Array.from({ length: SPARKS }, (_, i) => (
                <Spark key={i} index={i} t={t} color={taken ? colors.hitTaken : colors.hit} />
              ))}
          <Group transform={burstTransform}>
            <Path path={BURST} color={taken ? colors.hitTaken : colors.hit} />
            <Path
              path={BURST}
              color={colors.white}
              style="stroke"
              strokeWidth={4}
              strokeJoin="round"
            />
          </Group>
        </Group>
      </Canvas>
      <Animated.View style={[styles.labelWrap, labelStyle]}>
        <Text style={styles.label}>{`−${damage}`}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function Spark({ index, t, color }: { index: number; t: SharedValue<number>; color: string }) {
  const angle = (index / SPARKS) * Math.PI * 2 + 0.3;
  const cx = useDerivedValue(() => BOX / 2 + Math.cos(angle) * (20 + 36 * t.value));
  const cy = useDerivedValue(() => BOX / 2 + Math.sin(angle) * (20 + 36 * t.value));
  const r = useDerivedValue(() => 5 * (1 - t.value) + 1);
  return <Circle cx={cx} cy={cy} r={r} color={color} />;
}

const styles = StyleSheet.create({
  // Centred on the fighter tile's top-left corner, as in the design.
  box: { position: 'absolute', left: 35 - BOX / 2, top: 13 - BOX / 2, width: BOX, height: BOX },
  canvas: { width: BOX, height: BOX },
  labelWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.cardTitle, fontSize: 22, lineHeight: 26, color: colors.ink },
});
