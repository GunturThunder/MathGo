import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';
import { profile } from './profile/store';

// S4-11: the app going to the background and coming back.

const APP_DIR = './src/app';
const thisYear = new Date().getUTCFullYear();
let listeners: ((state: AppStateStatus) => void)[] = [];
const appGoes = (state: AppStateStatus) => act(() => listeners.forEach((l) => l(state)));

beforeEach(() => {
  listeners = [];
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    listeners.push(listener as (state: AppStateStatus) => void);
    return { remove: () => (listeners = listeners.filter((l) => l !== listener)) };
  });
  profile.reset();
  profile.setBirthYear(thisYear - 30);
  profile.completeOnboarding();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const tick = (ms: number) => {
  for (let t = 0; t < ms; t += 100) act(() => jest.advanceTimersByTime(100));
};

describe('practice pauses in the background (S4-11)', () => {
  it('the clock and the bot stand still while away, and carry on after', () => {
    jest.useFakeTimers();
    renderRouter(APP_DIR, { initialUrl: '/practice' });
    fireEvent.press(screen.getByTestId('practice-arena-1'));
    fireEvent.press(screen.getByTestId('practice-level-hard'));
    fireEvent.press(screen.getByTestId('practice-start'));
    tick(2_000);
    expect(screen.getByTestId('battle-timer')).toHaveTextContent('1:28');

    appGoes('background');
    tick(30_000); // a hard bot would land several hits in 30 s
    expect(screen.getByTestId('battle-timer')).toHaveTextContent('1:28');
    expect(screen.getByTestId('fighter-me-hp')).toHaveTextContent('100');

    appGoes('active');
    tick(2_000);
    expect(screen.getByTestId('battle-timer')).toHaveTextContent('1:26');
  });
});
