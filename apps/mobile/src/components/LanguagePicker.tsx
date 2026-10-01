import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGES, LANGUAGE_NAMES } from '../i18n';
import { colors, radii, sizes, space, typography } from '../theme';

export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.section} accessibilityRole="radiogroup">
      <Text style={styles.heading}>{t('settings.language')}</Text>
      {LANGUAGES.map((language) => {
        const selected = i18n.resolvedLanguage === language;
        return (
          <Pressable
            key={language}
            testID={`language-${language}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => void i18n.changeLanguage(language)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {LANGUAGE_NAMES[language]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  heading: { ...typography.cardTitle, color: colors.ink },
  option: {
    minHeight: sizes.touch + 4,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  selected: { backgroundColor: colors.blue, borderColor: colors.blue },
  label: { ...typography.bodyLarge, color: colors.ink },
  selectedLabel: { color: colors.white },
});
