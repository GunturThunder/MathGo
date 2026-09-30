import type { Translation } from './types';

export const en: Translation = {
  app: {
    name: 'MathGo',
  },
  home: {
    battle: 'Battle',
    practice: 'Practice',
    settings: 'Settings',
  },
  battle: {
    title: 'Battle',
    note: 'Online battles are coming soon.',
  },
  practice: {
    title: 'Practice',
    note: 'Practice against the bot is coming soon.',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    diagnostics: 'Diagnostics',
  },
  check: {
    title: 'game-core check (S1-08)',
    pass: 'PASS',
    fail: 'FAIL',
    engineHermes: 'Engine: Hermes',
    engineOther: 'Engine: not Hermes',
    seed: 'Seed: {{value}}',
    expected: 'Expected: {{value}}',
    actual: 'Actual: {{value}}',
    firstQuestion: 'First question: {{value}}',
  },
};
