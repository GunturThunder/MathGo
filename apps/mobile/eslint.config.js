import base from '@mathgo/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// S1-07: screens use the theme tokens only (src/theme), never raw colour values.
const RAW_COLOURS = [
  {
    selector: 'Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()/]',
    message: 'Use a colour from src/theme (colors, shapes) instead of a raw value.',
  },
  {
    selector: 'TemplateElement[value.raw=/(#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\()/]',
    message: 'Use a colour from src/theme (colors, shapes) instead of a raw value.',
  },
  {
    // Named colours in styles: color: 'red', backgroundColor: 'white', …
    selector: 'Property[key.name=/[cC]olor$/] > Literal[value=/^(?!transparent$)[a-z]+$/]',
    message: 'Use a colour from src/theme (colors, shapes) instead of a raw value.',
  },
];

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
        ...RAW_COLOURS,
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/theme/**'],
    rules: { 'no-restricted-syntax': ['error', ...RAW_COLOURS] },
  },
  {
    // Metro loads its config with require().
    files: ['*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
