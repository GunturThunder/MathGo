import * as battleClient from '@mathgo/battle-client';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { api } from './api';
import { clockNow } from './lib/clock';
import { profile } from './profile/store';

// S5-07: the matchmaking screen. Its own file: it drives the clock.
jest.mock('./lib/clock', () => ({ clockNow: jest.fn(() => 0) }));

const APP_DIR = './src/app';
const thisYear = new Date().getUTCFullYear();
let clock = 0;
let cancel: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  clock = 0;
  jest.mocked(clockNow).mockImplementation(() => clock);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  profile.reset();
  profile.setBirthYear(thisYear - 30);
  profile.completeOnboarding();
  jest.spyOn(api, 'session', 'get').mockReturnValue({ accessToken: 'a' } as never);
  jest.spyOn(api, 'me').mockReturnValue(new Promise(() => undefined));
  cancel = jest.fn(async () => undefined);
  // In the queue at 842 trophies (as the server reports), never matched.
  jest.mocked(battleClient.findMatch).mockImplementation(async (_o, _h, onQueued) => {
    onQueued?.(842);
    return { match: new Promise(() => undefined), cancel };
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Moves the clock and lets the screen's 1 s timer catch up. */
const wait = (ms: number) =>
  act(async () => {
    clock += ms;
    jest.advanceTimersByTime(ms);
  });

async function search() {
  renderRouter(APP_DIR);
  fireEvent.press(screen.getByTestId('home-battle'));
  await act(async () => undefined);
  expect(screen.getByTestId('matchmaking')).toBeOnTheScreen();
}

describe('matchmaking screen (S5-07)', () => {
  it('time waited and the trophy range, which widens by 50 every 5 s (FR-02)', async () => {
    await search();
    expect(screen.getByTestId('matchmaking-waited')).toHaveTextContent('0:00');
    expect(screen.getByTestId('matchmaking-range')).toHaveTextContent('742 – 942');
    await wait(7_000);
    expect(screen.getByTestId('matchmaking-waited')).toHaveTextContent('0:07');
    expect(screen.getByTestId('matchmaking-range')).toHaveTextContent('692 – 992');
  });

  it('Done when: the practice offer appears at 30 s, and takes you to practice', async () => {
    await search();
    await wait(29_000);
    expect(screen.getByTestId('matchmaking-practice')).toBeDisabled();
    expect(screen.getByTestId('matchmaking-offer-note')).toHaveTextContent('Terbuka di 0:30');
    await wait(1_000);
    expect(screen.getByTestId('matchmaking-practice')).toBeEnabled();
    expect(screen.getByTestId('matchmaking-offer-note')).toHaveTextContent(
      /Latihan dulu sambil menunggu/,
    );
    await act(async () => fireEvent.press(screen.getByTestId('matchmaking-practice')));
    expect(cancel).toHaveBeenCalled();
    expect(screen).toHavePathname('/practice');
  });

  it('Done when: Cancel leaves the queue and returns to Home', async () => {
    await search();
    await act(async () => fireEvent.press(screen.getByLabelText('Batal mencari')));
    expect(cancel).toHaveBeenCalled();
    expect(screen).toHavePathname('/');
    expect(screen.getByTestId('home')).toBeOnTheScreen();
  });

  it('the range never goes below 0', async () => {
    jest.mocked(battleClient.findMatch).mockImplementation(async (_o, _h, onQueued) => {
      onQueued?.(30);
      return { match: new Promise(() => undefined), cancel };
    });
    await search();
    expect(screen.getByTestId('matchmaking-range')).toHaveTextContent('0 – 130');
  });
});
