import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { profile } from '../profile/store';
import { en } from './en';
import { id } from './id';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';

export { DEFAULT_LANGUAGE, LANGUAGES, LANGUAGE_NAMES, type Language } from './languages';

export const resources = {
  id: { translation: id },
  en: { translation: en },
} as const;

// Resources are bundled, so initialise synchronously: the first render already has strings.
void i18n.use(initReactI18next).init({
  resources,
  // The language picked at first launch or in Settings, kept between launches.
  lng: profile.get().language ?? DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
