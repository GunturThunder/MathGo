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
  errors: {
    'update-required': 'This version of the app is out of date. Update MathGo to battle online.',
    'invalid-token': 'Your session ended. Reopen the app and try again.',
    'consent-required': 'Ask a parent to unlock online battles.',
    'room-not-found': "That code wasn't found. Check it and try again.",
    'room-full': 'That room is already full.',
    'room-expired': 'That code has expired. Ask for a new one.',
    'rate-limited': 'Too fast! Wait a moment.',
    'invalid-message': 'Something went wrong. Try again.',
  },
};
