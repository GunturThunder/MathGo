import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { FighterView } from '../../battle/battle-view';
import { colors, radii, shapes, space, typography, type ShapeName } from '../../theme';
import { TrophyIcon } from '../icons';
import { ShapeFighter } from '../ShapeFighter';
import { HitBurst } from './effects/HitBurst';
import { useFlinch, usePop } from './effects/pop';

export const HP_DRAIN_MS = 350;

/** The latest hit on this fighter; `id` 0 = none yet. */
export interface HitOn {
  readonly id: number;
  readonly damage: number;
  readonly fast: boolean;
}

interface FighterCardProps {
  fighter: FighterView;
  shape: ShapeName;
  side: 'me' | 'rival';
  compact: boolean;
  testID: string;
  /** Shown while the burst plays (S2-09). */
  hit?: HitOn | null;
}

/** One player's strip: shape, name, trophies, HP bar and HP number (design: Battle board). */
export const FighterCard = memo(function FighterCard({
  fighter,
  shape,
  side,
  compact,
  testID,
  hit,
}: FighterCardProps) {
  const { t } = useTranslation();
  const tile = compact ? 44 : 50;

  // HP drains smoothly instead of jumping.
  const share = useSharedValue(fighter.hpShare);
  useEffect(() => {
    share.value = withTiming(fighter.hpShare, {
      duration: HP_DRAIN_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [fighter.hpShare, share]);
  const barStyle = useAnimatedStyle(() => ({ width: `${share.value * 100}%` }));
  const flinch = useFlinch(hit?.id ?? 0, side);
  const fastPop = usePop(hit?.fast ? hit.id : 0);

  return (
    <View>
      <View
        style={[styles.card, compact && styles.cardCompact]}
        testID={testID}
        accessible
        accessibilityLabel={t('battleScreen.fighterHp', { name: fighter.name, value: fighter.hp })}
      >
        <Animated.View
          style={[
            styles.tile,
            { width: tile, height: tile, backgroundColor: shapes[shape].tile },
            flinch,
          ]}
        >
          <ShapeFighter shape={shape} size={tile * 0.72} />
        </Animated.View>
        <View style={styles.middle}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {fighter.name}
            </Text>
            {fighter.trophies === null ? null : (
              <View style={styles.trophies} testID={`${testID}-trophies`}>
                <TrophyIcon color={colors.ink2} />
                <Text style={styles.trophyText}>{fighter.trophies}</Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.track,
              { backgroundColor: side === 'me' ? colors.blueTrack : colors.orangeTrack },
            ]}
          >
            <Animated.View
              testID={`${testID}-bar`}
              style={[
                styles.bar,
                { backgroundColor: side === 'me' ? colors.blue : colors.orange },
                barStyle,
              ]}
            />
          </View>
        </View>
        <View style={styles.hp}>
          <Text style={styles.hpValue} testID={`${testID}-hp`}>
            {fighter.hp}
          </Text>
          <Text style={styles.hpLabel}>{t('battleScreen.hp')}</Text>
        </View>
      </View>
      {hit ? <HitBurst key={hit.id} damage={hit.damage} taken={side === 'me'} /> : null}
      {hit?.fast ? (
        <Animated.View
          style={[styles.fast, fastPop]}
          pointerEvents="none"
          testID={`${testID}-fast`}
        >
          <Text style={styles.fastText}>{t('battleScreen.fast')}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}, sameFighterCard);

/** Re-render only when what the card shows changes, not on every new view object. */
function sameFighterCard(a: FighterCardProps, b: FighterCardProps): boolean {
  return (
    a.fighter.name === b.fighter.name &&
    a.fighter.trophies === b.fighter.trophies &&
    a.fighter.hp === b.fighter.hp &&
    a.fighter.hpShare === b.fighter.hpShare &&
    a.shape === b.shape &&
    a.side === b.side &&
    a.compact === b.compact &&
    a.testID === b.testID &&
    a.hit === b.hit
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md + 2,
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    boxShadow: `0 10px 24px ${colors.shadow}`,
  },
  cardCompact: { paddingVertical: space.sm },
  tile: { alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
  middle: { flex: 1, minWidth: 0, gap: space.xs + 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...typography.cardTitle, fontSize: 17, lineHeight: 20, color: colors.ink, flexShrink: 1 },
  trophies: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trophyText: { ...typography.caption, fontSize: 12, lineHeight: 16, color: colors.ink2 },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 6 },
  hp: { minWidth: 40, alignItems: 'flex-end' },
  hpValue: { ...typography.cardTitle, fontSize: 24, lineHeight: 26, color: colors.ink },
  hpLabel: {
    ...typography.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: colors.ink2,
  },
  fast: {
    position: 'absolute',
    right: 64,
    top: -13,
    height: 26,
    justifyContent: 'center',
    paddingHorizontal: space.md - 2,
    borderRadius: 13,
    backgroundColor: colors.orange,
  },
  fastText: { ...typography.label, letterSpacing: 0.5, color: colors.ink },
});
