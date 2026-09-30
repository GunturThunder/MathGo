import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGES, LANGUAGE_NAMES } from '../i18n';

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
  section: { gap: 8 },
  heading: { fontSize: 16, fontWeight: '600' },
  option: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  selected: { backgroundColor: '#222', borderColor: '#222' },
  label: { fontSize: 16 },
  selectedLabel: { color: '#fff', fontWeight: '600' },
});
