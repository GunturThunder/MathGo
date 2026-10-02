export const LANGUAGES = ['id', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language's name in itself, so a player can always find their own. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
};

export const DEFAULT_LANGUAGE: Language = 'id';
