import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { FighterView } from '../../battle/battle-view';
import { colors, radii, shapes, space, typography, type ShapeName } from '../../theme';
import { TrophyIcon } from '../icons';
import { ShapeFighter } from '../ShapeFighter';

/** One player's strip: shape, name, trophies, HP bar and HP number (design: Battle board). */
export function FighterCard({
  fighter,
  shape,
  side,
  compact,
  testID,
}: {
  fighter: FighterView;
  shape: ShapeName;
  side: 'me' | 'rival';
  compact: boolean;
  testID: string;
}) {
  const { t } = useTranslation();
  const tile = compact ? 44 : 50;
  return (
    <View
      style={[styles.card, compact && styles.cardCompact]}
      testID={testID}
      accessible
      accessibilityLabel={t('battleScreen.fighterHp', { name: fighter.name, value: fighter.hp })}
    >
      <View
        style={[styles.tile, { width: tile, height: tile, backgroundColor: shapes[shape].tile }]}
      >
        <ShapeFighter shape={shape} size={tile * 0.72} />
      </View>
      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {fighter.name}
          </Text>
          <View style={styles.trophies}>
            <TrophyIcon color={colors.ink2} />
            <Text style={styles.trophyText}>{fighter.trophies}</Text>
          </View>
        </View>
        <View
          style={[
            styles.track,
            { backgroundColor: side === 'me' ? colors.blueTrack : colors.orangeTrack },
          ]}
        >
          <View
            testID={`${testID}-bar`}
            style={[
              styles.bar,
              {
                width: `${fighter.hpShare * 100}%`,
                backgroundColor: side === 'me' ? colors.blue : colors.orange,
              },
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
});
