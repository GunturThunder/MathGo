import base from '@mathgo/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['android/**', 'ios/**', 'expo-env.d.ts']),
  base,
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/\\S/]',
          message: 'User-facing text goes in src/i18n (id.ts and en.ts).',
        },
      ],
    },
  },
]);
