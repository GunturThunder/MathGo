import * as battleClient from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';
import { api } from './api';
import { clockNow } from './lib/clock';
import { profile } from './profile/store';

jest.mock('./lib/clock', () => ({ clockNow: jest.fn(() => 0) }));

// S4-11: an online battle after the app was in the background. Its own file: it drives the clock.

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
afterEach(() => jest.restoreAllMocks());

describe('online battles after the background (S4-11)', () => {
  it('the screen catches up the moment the app is back', async () => {
    let push: (m: ServerMessage) => void = () => undefined;
    jest.mocked(battleClient.findMatch).mockImplementation(async (_o, h) => {
      push = (m) => h.onMessage(m);
      return {
        match: Promise.resolve({
          roomId: 'r',
          sendAnswer: jest.fn(),
          requestRematch: jest.fn(),
          leave: jest.fn(async () => undefined),
          devSimulateDrop: jest.fn(),
        }),
        cancel: jest.fn(async () => undefined),
      };
    });
    jest.spyOn(api, 'session', 'get').mockReturnValue({ accessToken: 'a' } as never);
    let clock = 1_000;
    jest.mocked(clockNow).mockImplementation(() => clock);

    renderRouter(APP_DIR, { initialUrl: '/battle' });
    await act(async () => undefined);
    act(() => push({ type: 'joined', payload: { seat: 0, arena: 1, durationMs: 90_000 } }));
    act(() => push({ type: 'questions', payload: { questions: [{ index: 0, text: '2 + 2' }] } }));
    expect(screen.getByTestId('battle-timer')).toHaveTextContent('1:30');

    appGoes('background');
    clock += 5_000; // 5 s in another app
    appGoes('active');
    expect(screen.getByTestId('battle-timer')).toHaveTextContent('1:25');
    expect(screen.getByTestId('question')).toHaveTextContent('2 + 2');
  });
});
