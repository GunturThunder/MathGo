import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { id } from './id';

export const LANGUAGES = ['id', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language's name in itself, so a player can always find their own. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
};

export const DEFAULT_LANGUAGE: Language = 'id';

export const resources = {
  id: { translation: id },
  en: { translation: en },
} as const;

// Resources are bundled, so initialise synchronously: the first render already has strings.
void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
