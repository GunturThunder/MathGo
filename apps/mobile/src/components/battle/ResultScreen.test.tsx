import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BattleSummary } from '../../battle/battle-result';
import '../../i18n';
import { ResultScreen } from './ResultScreen';

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
