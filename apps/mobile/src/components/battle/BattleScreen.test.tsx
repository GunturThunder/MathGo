import { createBattle } from '@mathgo/game-core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EMPTY_ENTRY } from '../../battle/answer-entry';
import { battleView, type BattleView } from '../../battle/battle-view';
import '../../i18n';
import { BattleScreen } from './BattleScreen';
import { questionFontSize } from './QuestionPanel';

let mockWindowHeight = 844;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: mockWindowHeight, scale: 3, fontScale: 1 }),
}));

const fighters = {
  me: { name: 'SwiftComet27', trophies: 842 },
  rival: { name: 'ZippyPrism08', trophies: 865 },
};
const base = battleView(
  createBattle({ seed: 1, level: { arena: 3, trophies: 842 } }),
  0,
  fighters,
  0,
);
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function show(view: Partial<BattleView> = {}, height = 844) {
  mockWindowHeight = height;
  const onQuit = jest.fn();
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BattleScreen
        view={{ ...base, ...view }}
        question="7 × 8 − 12"
        entry={EMPTY_ENTRY}
        onKey={jest.fn()}
        onSubmit={jest.fn()}
        onQuit={onQuit}
      />
    </SafeAreaProvider>,
  );
  return { onQuit };
}

describe('battle screen layout (S2-08)', () => {
  it('shows both fighters, the timer, the question number and the question', () => {
    show({ rival: { ...base.rival, hp: 60, hpShare: 0.6 }, questionNumber: 12, timerText: '0:58' });
    expect(screen.getByTestId('fighter-rival-hp')).toHaveTextContent('60');
    expect(screen.getByTestId('fighter-me-hp')).toHaveTextContent('100');
    expect(screen.getByTestId('fighter-rival-bar')).toHaveStyle({ width: '60%' });
    expect(screen.getByText('ZippyPrism08')).toBeOnTheScreen();
    expect(screen.getByTestId('question-number')).toHaveTextContent('S12');
    expect(screen.getByLabelText('Sisa waktu 0:58')).toBeOnTheScreen();
    expect(screen.getByTestId('question')).toHaveTextContent('7 × 8 − 12');
    expect(screen.getByText('Arena 3 · Times Tower')).toBeOnTheScreen();
  });

  it('combo: flames, then "2× next hit"', () => {
    show({ comboLit: 2 });
    expect(screen.getByLabelText('Kombo 2 dari 3')).toBeOnTheScreen();
    expect(screen.queryByTestId('combo-ready')).toBeNull();
    screen.unmount();
    show({ comboLit: 3, comboReady: true });
    expect(screen.getByTestId('combo-ready')).toHaveTextContent('2× SERANGAN BERIKUTNYA');
  });

  it('the wrong-answer lock covers the keypad', () => {
    show({ locked: true });
    expect(screen.getByTestId('battle-locked')).toHaveTextContent('Ups! Terkunci 1 detik');
    expect(screen.getByTestId('key-submit')).toBeDisabled();
  });

  it('quit is a labelled button', () => {
    const { onQuit } = show();
    fireEvent.press(screen.getByLabelText('Keluar dari pertarungan. Keluar dihitung kalah'));
    expect(onQuit).toHaveBeenCalled();
  });

  it('small phones: 48 pt keys; large phones: 56 pt', () => {
    show({}, 844);
    expect(screen.getByTestId('key-5')).toHaveStyle({ height: 56 });
    screen.unmount();
    show({}, 667);
    expect(screen.getByTestId('key-5')).toHaveStyle({ height: 48 });
  });

  it('the ± key only in Power Peak', () => {
    show({ arena: 5, arenaName: 'Power Peak' });
    expect(screen.getByTestId('key-sign')).toBeOnTheScreen();
  });

  it('long questions shrink to stay on one line', () => {
    expect(questionFontSize('7 × 8', false)).toBe(52);
    expect(questionFontSize('12² − 45 ÷ 5 × 3', false)).toBe(36);
    expect(questionFontSize('(24 + 16) ÷ 8 × 3 − 1', false)).toBe(31);
    expect(questionFontSize('7 × 8', true)).toBe(44);
  });
});
