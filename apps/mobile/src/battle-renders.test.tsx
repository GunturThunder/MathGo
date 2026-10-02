import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// S2-12: the battle screen must not re-render more than it shows. Re-renders run on the JS
// thread, which also handles taps; fewer of them keep typing and effects smooth.

const APP_DIR = './src/app';

// Each fighter card draws one ShapeFighter, so its renders count the cards' renders.
let mockShapeRenders = 0;
jest.mock('./components/ShapeFighter', () => {
  const actual = jest.requireActual('./components/ShapeFighter');
  return {
    ...actual,
    ShapeFighter: (props: { shape: string; size: number }) => {
      mockShapeRenders += 1;
      return actual.ShapeFighter(props);
    },
  };
});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function startPractice() {
  renderRouter(APP_DIR, { initialUrl: '/practice' });
  fireEvent.press(screen.getByTestId('practice-arena-1'));
  // Easy in Counting Camp thinks 9 s or more: no hits in the first 5 s.
  fireEvent.press(screen.getByTestId('practice-level-easy'));
  fireEvent.press(screen.getByTestId('practice-start'));
}
/** One act() per 100 ms tick, as frames come on a phone. */
const tick = (ms: number) => {
  for (let t = 0; t < ms; t += 100) act(() => jest.advanceTimersByTime(100));
};

describe('battle screen re-renders (S2-12)', () => {
  it('idle: the fighter cards stay put while the timer still counts every second', () => {
    startPractice();
    mockShapeRenders = 0;
    tick(5_000);
    expect(mockShapeRenders).toBe(0);
    expect(screen.getByTestId('battle-timer')).toHaveTextContent('1:25');
  });

  it('typing re-renders the answer field, not the fighter cards', () => {
    startPractice();
    mockShapeRenders = 0;
    for (const d of ['1', '2', '3'])
      act(() => fireEvent(screen.getByTestId(`key-${d}`), 'pressIn'));
    expect(mockShapeRenders).toBe(0);
    expect(screen.getByTestId('answer-field')).toHaveTextContent('12');
  });

  it('a hit re-renders the cards', () => {
    startPractice();
    mockShapeRenders = 0;
    tick(20_000);
    expect(mockShapeRenders).toBeGreaterThan(0);
  });
});
