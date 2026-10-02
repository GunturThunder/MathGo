import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { ARENAS } from '@mathgo/game-core';
import { DEFAULT_LANGUAGE, i18n } from './i18n';

const APP_DIR = './src/app';
const ROUTES = ['/', '/battle', '/practice', '/settings'];
/** The same in both languages: the brand, and language names written in their own language. */
const SAME_IN_EVERY_LANGUAGE = new Set([
  'MathBattle',
  'Arena',
  'Bahasa Indonesia',
  'English',
  // Arena names are proper names (PRD), the same in both languages.
  ...ARENAS.map((a) => a.name),
]);

/** The shape of `screen.toJSON()`. */
type Node = string | { type: string; children: Node[] | null };

/** The text of every <Text> on screen, header included, in render order. */
function visibleTexts(): string[] {
  const texts: string[] = [];
  const visit = (node: Node | Node[] | null): void => {
    if (node === null || typeof node === 'string') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'Text') {
      const own = (node.children ?? []).filter((c): c is string => typeof c === 'string');
      if (own.length > 0) texts.push(own.join(''));
    }
    (node.children ?? []).forEach(visit);
  };
  visit(screen.toJSON() as Node | Node[] | null);
  return texts;
}

function textsPerRoute(): string[][] {
  return ROUTES.map((initialUrl) => {
    renderRouter(APP_DIR, { initialUrl });
    const texts = visibleTexts();
    screen.unmount();
    return texts;
  });
}

describe('language', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await act(() => i18n.changeLanguage(DEFAULT_LANGUAGE));
  });

  it('starts in Bahasa Indonesia', () => {
    renderRouter(APP_DIR);
    expect(screen.getByTestId('home-battle')).toHaveTextContent('Bertarung');
    expect(screen.getByTestId('home-settings')).toHaveTextContent('Pengaturan');
  });

  it('switching to English in Settings changes every string on every screen', () => {
    const before = textsPerRoute();

    renderRouter(APP_DIR, { initialUrl: '/settings' });
    expect(screen.getByTestId('language-id')).toBeSelected();
    fireEvent.press(screen.getByTestId('language-en'));
    expect(screen.getByTestId('language-en')).toBeSelected();
    expect(screen.getByText('Language')).toBeOnTheScreen();
    screen.unmount();

    const after = textsPerRoute();
    ROUTES.forEach((route, i) => {
      const was = before[i] ?? [];
      const now = after[i] ?? [];
      expect(was.length).toBeGreaterThan(0);
      expect({ route, count: now.length }).toEqual({ route, count: was.length });
      now.forEach((text, j) => {
        if (!SAME_IN_EVERY_LANGUAGE.has(text) && !/^\d+$/.test(text)) {
          expect({ route, text }).not.toEqual({ route, text: was[j] });
        }
      });
    });
    expect(after[0]).toEqual(expect.arrayContaining(['Battle', 'Practice', 'Settings']));
  });

  it('switches back to Bahasa Indonesia', () => {
    renderRouter(APP_DIR, { initialUrl: '/settings' });
    fireEvent.press(screen.getByTestId('language-en'));
    fireEvent.press(screen.getByTestId('language-id'));
    expect(screen.getByText('Bahasa')).toBeOnTheScreen();
  });
});
