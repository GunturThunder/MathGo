import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnswerEntry, KeypadKey } from '../../battle/answer-entry';
import { colors, radii, space, typography } from '../../theme';
import { AnswerField } from '../AnswerField';
import { FlameIcon } from '../icons';
import { usePop, useShake } from './effects/pop';

/** Long questions shrink to stay on one line (design: 52 → 31 px). */
export function questionFontSize(text: string, compact: boolean): number {
  const len = text.length;
  const size = len <= 10 ? 52 : len <= 14 ? 42 : len <= 17 ? 36 : 31;
  return compact ? Math.round(size * 0.85) : size;
}

/** The night panel: combo flames, the question, and the answer field. */
export function QuestionPanel({
  question,
  comboLit,
  comboReady,
  arenaLabel,
  entry,
  showSign,
  onKey,
  compact,
  missKey = 0,
}: {
  question: string;
  comboLit: number;
  comboReady: boolean;
  arenaLabel: string;
  entry: AnswerEntry;
  showSign: boolean;
  onKey: (key: KeypadKey) => void;
  compact: boolean;
  /** Changes on each wrong answer: the answer field shakes (S2-09). */
  missKey?: number;
}) {
  const { t } = useTranslation();
  const fontSize = questionFontSize(question, compact);
  const shake = useShake(missKey);
  const readyPop = usePop(comboReady ? 1 : 0);
  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      <View style={styles.top}>
        <View
          style={styles.combo}
          accessible
          accessibilityLabel={t('battleScreen.combo', { value: comboLit })}
          testID="combo"
        >
          <Text style={styles.comboLabel}>{t('battleScreen.comboLabel')}</Text>
          <View style={styles.flames}>
            {[1, 2, 3].map((i) => (
              <Flame key={i} lit={i <= comboLit} />
            ))}
          </View>
        </View>
        {comboReady ? (
          <Animated.View style={[styles.ready, readyPop]} testID="combo-ready">
            <Text style={styles.readyText}>{t('battleScreen.comboReady')}</Text>
          </Animated.View>
        ) : (
          <Text style={styles.arena} numberOfLines={1}>
            {arenaLabel}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.question,
          { fontSize, lineHeight: Math.round(fontSize * 1.1) },
          compact && styles.questionCompact,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLiveRegion="polite"
        testID="question"
      >
        {question}
      </Text>
      <Animated.View style={shake}>
        <AnswerField entry={entry} showSign={showSign} onKey={onKey} compact={compact} />
      </Animated.View>
    </View>
  );
}

/** A combo flame that pops each time it lights. */
function Flame({ lit }: { lit: boolean }) {
  const lights = useRef(0);
  const wasLit = useRef(lit);
  if (lit && !wasLit.current) lights.current += 1;
  wasLit.current = lit;
  const pop = usePop(lights.current);
  return (
    <Animated.View style={lit ? pop : null}>
      <FlameIcon color={lit ? colors.orange : colors.comboOff} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    paddingTop: space.lg,
    paddingHorizontal: space.lg + 2,
    paddingBottom: space.xl,
    borderRadius: radii.card + 2,
    backgroundColor: colors.night,
  },
  panelCompact: { gap: space.sm, paddingTop: space.md, paddingBottom: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 26 },
  combo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  comboLabel: { ...typography.label, fontSize: 11, lineHeight: 14, color: colors.nightMuted },
  flames: { flexDirection: 'row', gap: 2 },
  ready: {
    height: 24,
    justifyContent: 'center',
    paddingHorizontal: space.md - 2,
    borderRadius: radii.md - 4,
    backgroundColor: colors.orange,
  },
  readyText: {
    ...typography.label,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: colors.ink,
  },
  arena: {
    ...typography.caption,
    fontSize: 12,
    color: colors.nightMuted,
    flexShrink: 1,
    marginLeft: space.sm,
  },
  question: {
    ...typography.question,
    minHeight: 64,
    color: colors.white,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  questionCompact: { minHeight: 48 },
});
