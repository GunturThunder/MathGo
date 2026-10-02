import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ArrowIcon, ChevronIcon, ShieldIcon } from '../../components/icons';
import { OnboardingScreen } from '../../components/onboarding/Screen';
import { NEWEST_BIRTH_YEAR_OFFSET, OLDEST_BIRTH_YEAR, isAdult } from '../../profile/age';
import { profile } from '../../profile/store';
import { colors, radii, sizes, space, typography } from '../../theme';
import { finishOnboarding } from '../../profile/finish-onboarding';

const PAGE = 16;

/**
 * First launch, step 2 (design: 14 Birth year; FR-20). Nothing is picked for the player: they
 * choose their year themselves. Only the year is kept.
 */
export default function BirthYear() {
  const { t } = useTranslation();
  const newest = new Date().getUTCFullYear() - NEWEST_BIRTH_YEAR_OFFSET;
  const [end, setEnd] = useState(newest);
  const [picked, setPicked] = useState<number | null>(null);
  const start = Math.max(OLDEST_BIRTH_YEAR, end - PAGE + 1);
  const years = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const next = () => {
    if (picked === null) return;
    profile.setBirthYear(picked);
    // Adults pick a battle name and get an online account. Under-18 players practise until a
    // parent unlocks online play, and pick a name after that (S3-09, S5-09).
    if (isAdult(picked, new Date())) router.push('/onboarding/name');
    else finishOnboarding();
  };

  return (
    <OnboardingScreen
      testID="onboarding-birth-year"
      title={t('onboarding.birthYearTitle')}
      subtitle={t('onboarding.birthYearSubtitle')}
      onBack={() => router.back()}
      footer={
        <Button
          label={t('onboarding.continue')}
          icon={<ArrowIcon color={colors.white} />}
          onPress={next}
          disabled={picked === null}
          testID="onboarding-continue"
        />
      }
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.label}>{t('onboarding.birthYearLabel')}</Text>
          <Text style={styles.picked} testID="birth-year-picked">
            {picked ?? '–'}
          </Text>
        </View>
        <View
          style={styles.grid}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('onboarding.pickYear')}
        >
          {years.map((year) => {
            const on = year === picked;
            return (
              <Pressable
                key={year}
                testID={`year-${year}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setPicked(year)}
                style={[styles.year, on && styles.yearOn]}
              >
                <Text style={[styles.yearText, on && styles.yearTextOn]}>{year}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.pager}>
          <Pressable
            testID="years-earlier"
            accessibilityRole="button"
            disabled={start <= OLDEST_BIRTH_YEAR}
            onPress={() => setEnd(Math.max(OLDEST_BIRTH_YEAR + PAGE - 1, end - PAGE))}
            style={styles.page}
          >
            <ChevronIcon color={colors.ink} direction="left" />
            <Text style={styles.pageText}>{t('onboarding.earlier')}</Text>
          </Pressable>
          <Text style={styles.range}>{`${start} – ${end}`}</Text>
          <Pressable
            testID="years-later"
            accessibilityRole="button"
            disabled={end >= newest}
            onPress={() => setEnd(Math.min(newest, end + PAGE))}
            style={[styles.page, end >= newest && styles.pageOff]}
          >
            <Text style={styles.pageText}>{t('onboarding.later')}</Text>
            <ChevronIcon color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.note}>
          <ShieldIcon color={colors.success} />
          <Text style={styles.noteText}>{t('onboarding.birthYearNote')}</Text>
        </View>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md + 2,
    padding: space.lg,
    borderRadius: radii.card - 2,
    backgroundColor: colors.white,
    boxShadow: `0 12px 28px ${colors.shadow}`,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...typography.label, color: colors.ink2 },
  picked: { ...typography.cardTitle, color: colors.blue },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  year: {
    width: '23%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ground,
    boxShadow: `0 4px 0 ${colors.keyBase}`,
  },
  yearOn: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
    boxShadow: `0 4px 0 ${colors.blueBase}`,
  },
  yearText: { ...typography.cardTitle, fontSize: 19, color: colors.ink },
  yearTextOn: { color: colors.white },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  page: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: sizes.touch,
    paddingHorizontal: space.md + 2,
    borderRadius: sizes.touch / 2,
    backgroundColor: colors.surfaceSoft,
  },
  pageOff: { opacity: 0.4 },
  pageText: { ...typography.body, fontSize: 14, color: colors.ink },
  range: { ...typography.caption, color: colors.ink2 },
  divider: { height: 1, backgroundColor: colors.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  noteText: { ...typography.caption, flex: 1, color: colors.ink2 },
});
