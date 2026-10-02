import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowIcon } from '../../components/icons';
import { Button } from '../../components/Button';
import { OnboardingScreen } from '../../components/onboarding/Screen';
import { LANGUAGES, LANGUAGE_NAMES, type Language } from '../../i18n';
import { profile } from '../../profile/store';
import { colors, radii, space, typography } from '../../theme';

const CODES: Record<Language, string> = { id: 'ID', en: 'EN' };

/** First launch, step 1 (design: 13 Language). Tapping a language switches the app at once. */
export default function ChooseLanguage() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage as Language;
  const pick = (language: Language) => {
    profile.setLanguage(language);
    void i18n.changeLanguage(language);
  };
  return (
    <OnboardingScreen
      testID="onboarding-language"
      title={t('onboarding.languageTitle')}
      subtitle={t('onboarding.languageSubtitle')}
      onBack={() => router.back()}
      footer={
        <Button
          label={t('onboarding.continue')}
          icon={<ArrowIcon color={colors.white} />}
          onPress={() => {
            pick(current);
            router.push('/onboarding/birth-year');
          }}
          testID="onboarding-continue"
        />
      }
    >
      <View style={styles.list} accessibilityRole="radiogroup">
        {LANGUAGES.map((language) => {
          const on = language === current;
          return (
            <Pressable
              key={language}
              testID={`onboarding-language-${language}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => pick(language)}
              style={[styles.option, on && styles.optionOn]}
            >
              <View style={[styles.code, on && styles.codeOn]}>
                <Text style={[styles.codeText, on && styles.codeTextOn]}>{CODES[language]}</Text>
              </View>
              <Text style={styles.name}>{LANGUAGE_NAMES[language]}</Text>
              <View style={[styles.dot, on && styles.dotOn]} />
            </Pressable>
          );
        })}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    height: 76,
    paddingLeft: space.md,
    paddingRight: space.lg + 2,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  optionOn: { borderWidth: 3, borderColor: colors.blue },
  code: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg - 2,
    backgroundColor: colors.ground,
  },
  codeOn: { backgroundColor: colors.blue },
  codeText: { ...typography.cardTitle, fontSize: 19, color: colors.ink2 },
  codeTextOn: { color: colors.white },
  name: { ...typography.cardTitle, flex: 1, fontSize: 21, color: colors.ink },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.placeholder },
  dotOn: { borderWidth: 8, borderColor: colors.blue },
});
