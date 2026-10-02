import { createMMKV, type MMKV } from 'react-native-mmkv';
import { LANGUAGES, type Language } from '../i18n/languages';

// What the first launch flow (S3-08) learns, kept on the phone between launches. The birth
// year is the only age data (FR-20); no birthday, no real name.

export interface Profile {
  readonly language: Language | null;
  readonly birthYear: number | null;
  /** The first launch flow is finished: open on Home from now on. */
  readonly onboarded: boolean;
}

export interface ProfileStore {
  get(): Profile;
  setLanguage(language: Language): void;
  setBirthYear(year: number): void;
  completeOnboarding(): void;
  /** Dev builds: run the first launch flow again. */
  reset(): void;
}

const isLanguage = (value: string | undefined): value is Language =>
  (LANGUAGES as readonly string[]).includes(value ?? '');

export function createProfileStore(
  storage: MMKV = createMMKV({ id: 'mathgo-profile' }),
): ProfileStore {
  return {
    get() {
      const language = storage.getString('language');
      return {
        language: isLanguage(language) ? language : null,
        birthYear: storage.getNumber('birthYear') ?? null,
        onboarded: storage.getBoolean('onboarded') ?? false,
      };
    },
    setLanguage: (language) => storage.set('language', language),
    setBirthYear: (year) => storage.set('birthYear', year),
    completeOnboarding: () => storage.set('onboarded', true),
    reset: () => {
      storage.remove('birthYear');
      storage.remove('onboarded');
    },
  };
}

export const profile = createProfileStore();
