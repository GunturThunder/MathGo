import { createBattle } from '@mathgo/game-core';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EMPTY_ENTRY } from '../../battle/answer-entry';
import { battleView, type BattleView } from '../../battle/battle-view';
import type { QueuedEffect } from '../../battle/effects';
import '../../i18n';
import { arenaThemes } from '../../theme';
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

function show(
  view: Partial<BattleView> = {},
  height = 844,
  effects: QueuedEffect[] = [],
  onPlayAgain?: () => void,
) {
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
        effects={effects}
        {...(onPlayAgain ? { onPlayAgain } : {})}
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
    expect(screen.getByTestId('fighter-rival-trophies')).toHaveTextContent('865');
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

describe('battle effects (S2-09)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('my fast hit: a burst with the damage and FAST +5 on the rival, gone after 700 ms', () => {
    show({}, 844, [{ id: 1, kind: 'hit', by: 'me', damage: 15, fast: true, combo: false }]);
    expect(screen.getByTestId('hit-burst')).toHaveTextContent('−15');
    expect(screen.getByTestId('fighter-rival-fast')).toHaveTextContent('CEPAT +5');
    expect(screen.queryByTestId('fighter-me-fast')).toBeNull();
    act(() => jest.advanceTimersByTime(700));
    expect(screen.queryByTestId('hit-burst')).toBeNull();
  });

  it("the rival's hit lands on my card", () => {
    show({}, 844, [{ id: 1, kind: 'hit', by: 'rival', damage: 10, fast: false, combo: false }]);
    expect(screen.getByTestId('hit-burst')).toHaveTextContent('−10');
    expect(screen.queryByTestId('fighter-rival-fast')).toBeNull();
  });

  it('a knockout shows the end card, with Play again', () => {
    const again = jest.fn();
    show({}, 844, [{ id: 1, kind: 'end', outcome: 'win', reason: 'ko' }], again);
    expect(screen.getByTestId('battle-end-title')).toHaveTextContent('K.O.!');
    fireEvent.press(screen.getByTestId('battle-end-again'));
    expect(again).toHaveBeenCalled();
  });

  it.each([
    ['lose', 'ko', 'Kena K.O.'],
    ['lose', 'time', 'Kalah'],
    ['win', 'forfeit', 'Menang!'],
    ['draw', 'time', 'Seri!'],
  ] as const)('%s by %s: "%s"', (outcome, reason, title) => {
    show({}, 844, [{ id: 1, kind: 'end', outcome, reason }]);
    expect(screen.getByTestId('battle-end-title')).toHaveTextContent(title);
  });

  it('effects already played are not replayed', () => {
    const effects: QueuedEffect[] = [
      { id: 1, kind: 'hit', by: 'me', damage: 10, fast: false, combo: false },
    ];
    show({}, 844, effects);
    act(() => jest.advanceTimersByTime(700));
    screen.rerender(
      <SafeAreaProvider initialMetrics={metrics}>
        <BattleScreen
          view={base}
          question="7 × 8 − 12"
          entry={EMPTY_ENTRY}
          onKey={jest.fn()}
          onSubmit={jest.fn()}
          onQuit={jest.fn()}
          effects={[...effects]}
        />
      </SafeAreaProvider>,
    );
    expect(screen.queryByTestId('hit-burst')).toBeNull();
  });
});

describe('arena look (S5-10)', () => {
  it.each([1, 2, 3, 4, 5] as const)('arena %i: its ground and its chip', (arena) => {
    show({ arena, arenaName: 'X' });
    expect(screen.getByTestId('battle-screen')).toHaveStyle({
      backgroundColor: arenaThemes[arena].ground,
    });
    expect(screen.getByTestId('arena-chip')).toHaveStyle({
      backgroundColor: arenaThemes[arena].chip,
    });
    expect(screen.getByTestId('arena-chip')).toHaveTextContent(`Arena ${arena} · X`);
  });
});
