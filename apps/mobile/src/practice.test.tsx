import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Route tests live outside src/app, where every file would become a screen.
const APP_DIR = './src/app';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function startPractice(arena = 1, level: 'easy' | 'medium' | 'hard' = 'medium') {
  renderRouter(APP_DIR, { initialUrl: '/practice' });
  fireEvent.press(screen.getByTestId(`practice-arena-${arena}`));
  fireEvent.press(screen.getByTestId(`practice-level-${level}`));
  fireEvent.press(screen.getByTestId('practice-start'));
}
const run = (ms: number) => act(() => jest.advanceTimersByTime(ms));

describe('practice vs bot (S2-10)', () => {
  it('Home › Latihan opens the practice setup', () => {
    renderRouter(APP_DIR);
    fireEvent.press(screen.getByTestId('home-practice'));
    expect(screen.getByTestId('practice-setup')).toBeOnTheScreen();
    expect(screen.getByText('Tanpa trofi, dan bisa dimainkan tanpa internet.')).toBeOnTheScreen();
  });

  it('clearly labelled: the bot, the mode, and no trophies', () => {
    startPractice(3, 'hard');
    expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
    expect(screen.getByText('Bot · Sulit')).toBeOnTheScreen();
    expect(screen.getByText('Kamu')).toBeOnTheScreen();
    expect(screen.getByText('Latihan · Times Tower')).toBeOnTheScreen();
    expect(screen.getByLabelText('Keluar dari latihan')).toBeOnTheScreen();
    // No trophy counts on either card.
    expect(screen.queryByTestId('fighter-me-trophies')).toBeNull();
    expect(screen.queryByTestId('fighter-rival-trophies')).toBeNull();
  });

  it('the bot plays on its own and hits the player', () => {
    // Medium thinks 7.5 s or more per answer: it hits within 30 s but can't knock out.
    startPractice(1, 'medium');
    run(30_000);
    expect(Number(screen.getByTestId('fighter-me-hp').props.children)).toBeLessThan(100);
  });

  it('a full 90 s battle ends with Play again and Home', () => {
    startPractice(1, 'easy');
    run(91_000);
    expect(screen.getByTestId('battle-end')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('battle-end-again'));
    expect(screen.queryByTestId('battle-end')).toBeNull();
    expect(screen.getByTestId('fighter-me-hp')).toHaveTextContent('100');
    expect(screen.getByTestId('fighter-rival-hp')).toHaveTextContent('100');
  });

  it('Done when (S2-11): the result screen follows the battle, with Play again and Home', () => {
    renderRouter(APP_DIR);
    fireEvent.press(screen.getByTestId('home-practice'));
    fireEvent.press(screen.getByTestId('practice-start'));
    run(91_000);
    fireEvent.press(screen.getByTestId('battle-end-results'));
    expect(screen.getByTestId('result-screen')).toBeOnTheScreen();
    expect(screen.getByText('Latihan')).toBeOnTheScreen();
    expect(screen.getByTestId('result-title')).toHaveTextContent(/^(Menang!|Kalah|Seri!)$/);
    fireEvent.press(screen.getByTestId('result-again'));
    expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('fighter-rival-hp')).toHaveTextContent('100');
    run(91_000);
    fireEvent.press(screen.getByTestId('battle-end-results'));
    fireEvent.press(screen.getByTestId('result-home'));
    expect(screen).toHavePathname('/');
  });
});
