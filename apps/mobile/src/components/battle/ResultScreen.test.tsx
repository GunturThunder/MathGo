import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BattleSummary } from '../../battle/battle-result';
import '../../i18n';
import * as haptics from '../../battle/haptics';
import { clockNow } from '../../lib/clock';
import { ResultScreen } from './ResultScreen';

jest.mock('../../lib/clock', () => ({ clockNow: jest.fn(() => 0) }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const win: BattleSummary = {
  outcome: 'win',
  reason: 'ko',
  secondsLeft: 22,
  correct: 9,
  answered: 10,
  bestCombo: 6,
  me: { name: 'Kamu', damage: 100 },
  rival: { name: 'Bot · Sedang', damage: 60 },
  trophies: null,
};

function show(summary: BattleSummary) {
  const handlers = { onPlayAgain: jest.fn(), onHome: jest.fn() };
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ResultScreen summary={summary} modeLabel="Latihan" {...handlers} />
    </SafeAreaProvider>,
  );
  return handlers;
}

describe('result screen (S2-11)', () => {
  it('a win by KO: title, time left, right answers, best combo, damage both ways', () => {
    show(win);
    expect(screen.getByTestId('result-title')).toHaveTextContent('Menang!');
    expect(screen.getByTestId('result-subtitle')).toHaveTextContent(
      'Kamu menjatuhkan Bot · Sedang dengan sisa 22 detik.',
    );
    expect(screen.getByTestId('result-answers')).toHaveTextContent('9/10Jawaban benar');
    expect(screen.getByTestId('result-combo')).toHaveTextContent('6Kombo terbaik');
    expect(screen.getByTestId('result-me')).toHaveTextContent(/100 serangan/);
    expect(screen.getByTestId('result-rival')).toHaveTextContent(/60 serangan/);
  });

  it.each([
    [
      { outcome: 'lose', reason: 'time' },
      'Kalah',
      'Bot · Sedang punya HP lebih banyak saat waktu habis.',
    ],
    [
      { outcome: 'lose', reason: 'ko' },
      'Kalah',
      'Bot · Sedang menjatuhkanmu dengan sisa 22 detik.',
    ],
    [{ outcome: 'draw', reason: 'time' }, 'Seri!', 'HP sama saat waktu habis.'],
  ] as const)('%o', (end, title, subtitle) => {
    show({ ...win, ...end });
    expect(screen.getByTestId('result-title')).toHaveTextContent(title);
    expect(screen.getByTestId('result-subtitle')).toHaveTextContent(subtitle);
  });

  it('Play again, Home and close', () => {
    const { onPlayAgain, onHome } = show(win);
    fireEvent.press(screen.getByTestId('result-again'));
    fireEvent.press(screen.getByTestId('result-home'));
    fireEvent.press(screen.getByLabelText('Tutup'));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(2);
  });
});

describe('ranked results: trophies and a new arena (S5-08)', () => {
  const ranked = (delta: number, now: number, arenaBefore: 1 | 2 | 5, arenaAfter: 1 | 2 | 5) =>
    ({ ...win, trophies: { delta, now, arenaBefore, arenaAfter } }) satisfies BattleSummary;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(clockNow).mockReturnValue(0);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** Lets the count-up run to the end. */
  const settle = () =>
    act(() => {
      jest.mocked(clockNow).mockReturnValue(5_000);
      jest.advanceTimersByTime(100);
    });

  it('Done when: crossing 300 trophies shows the Plus Plains unlock', () => {
    const unlock = jest.spyOn(haptics, 'unlockFeedback');
    show(ranked(30, 310, 1, 2));
    // The new arena comes first, over the results (the screen behind is hidden from readers).
    expect(screen.getByTestId('result-unlock')).toHaveTextContent(/Arena baru terbuka!/);
    expect(screen.getByTestId('result-unlock-name')).toHaveTextContent('Plus Plains');
    expect(screen.getByTestId('result-unlock')).toHaveTextContent(/Tambah dan kurang sampai 100/);
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('result-trophy-delta')).toBeNull();
    fireEvent.press(screen.getByTestId('result-unlock-ok'));
    expect(screen.queryByTestId('result-unlock')).toBeNull();
    expect(screen.getByTestId('result-trophy-delta')).toHaveTextContent('+30Trofi');
    expect(screen.queryByTestId('result-combo')).toBeNull();
    // The count starts from before the battle, then counts up.
    expect(screen.getByTestId('result-trophies-value')).toHaveTextContent('280');
    settle();
    expect(screen.getByTestId('result-trophies-value')).toHaveTextContent('310');
    expect(screen.getByTestId('result-next-arena')).toHaveTextContent('390 lagi ke Times Tower');
  });

  it('a loss takes trophies away, with no unlock', () => {
    show(ranked(-20, 1_180, 1, 1));
    expect(screen.getByTestId('result-trophy-delta')).toHaveTextContent('\u221220Trofi');
    expect(screen.getByTestId('result-trophies-value')).toHaveTextContent('1.200');
    settle();
    expect(screen.getByTestId('result-trophies-value')).toHaveTextContent('1.180');
    expect(screen.queryByTestId('result-unlock')).toBeNull();
  });

  it('staying in an arena: no unlock; the top arena says so', () => {
    show(ranked(25, 2_525, 5, 5));
    expect(screen.queryByTestId('result-unlock')).toBeNull();
    expect(screen.getByTestId('result-next-arena')).toHaveTextContent('Arena tertinggi');
  });

  it('practice and friendly results keep the best combo', () => {
    show(win);
    expect(screen.getByTestId('result-combo')).toBeOnTheScreen();
    expect(screen.queryByTestId('result-trophies-now')).toBeNull();
  });
});
