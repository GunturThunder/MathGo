import * as battleClient from '@mathgo/battle-client';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { api } from './api';
import { findMatchAsPlayer } from './net/battle';
import { OnlineLockedError, onlineLocked } from './profile/online';
import { profile } from './profile/store';

const APP_DIR = './src/app';
const thisYear = new Date().getUTCFullYear();

jest.mock('@mathgo/battle-client', () => ({
  ...jest.requireActual('@mathgo/battle-client'),
  findMatch: jest.fn(() => Promise.reject(new Error('should not connect in this test'))),
}));

let fetchSpy: jest.SpyInstance;
let sockets: jest.SpyInstance;

function asPlayer(birthYear: number) {
  profile.reset();
  api.signOut();
  profile.setBirthYear(birthYear);
  profile.completeOnboarding();
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in tests'));
  sockets = jest.spyOn(globalThis, 'WebSocket' as never);
  jest.mocked(battleClient.findMatch).mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('under-18 mode (S3-09)', () => {
  it('the lock follows the server rule: under 18 by birth year, no account yet', () => {
    asPlayer(thisYear - 10);
    expect(onlineLocked()).toBe(true);
    asPlayer(thisYear - 18); // turns 18 this year: not certainly 18 yet
    expect(onlineLocked()).toBe(true);
    asPlayer(thisYear - 30);
    expect(onlineLocked()).toBe(false);
  });

  it('Home: Battle opens "Ask a parent", which offers practice', () => {
    asPlayer(thisYear - 10);
    renderRouter(APP_DIR);
    expect(screen.getByTestId('home-battle')).toHaveTextContent(/Minta izin orang tua dulu/);
    fireEvent.press(screen.getByTestId('home-battle'));
    expect(screen).toHavePathname('/ask-parent');
    expect(screen.getByText('Minta orang tua membuka pertarungan online')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('ask-parent-practice'));
    expect(screen).toHavePathname('/practice');
  });

  it('the online battle route itself redirects to "Ask a parent"', () => {
    asPlayer(thisYear - 10);
    renderRouter(APP_DIR, { initialUrl: '/battle' });
    expect(screen).toHavePathname('/ask-parent');
  });

  it('Settings hides the dev battle card', () => {
    asPlayer(thisYear - 10);
    renderRouter(APP_DIR, { initialUrl: '/settings' });
    expect(screen.queryByTestId('battle-dev-card')).toBeNull();
  });

  it('Done when: no network call to battle services for an under-18 player', async () => {
    asPlayer(thisYear - 10);
    for (const url of ['/', '/battle', '/ask-parent', '/settings', '/practice']) {
      renderRouter(APP_DIR, { initialUrl: url });
      screen.unmount();
    }
    await expect(findMatchAsPlayer({ onMessage: () => undefined })).rejects.toBeInstanceOf(
      OnlineLockedError,
    );
    expect(battleClient.findMatch).not.toHaveBeenCalled();
    expect(sockets).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('adults are not locked: Battle opens the battle screen and matchmaking may connect', async () => {
    asPlayer(thisYear - 30);
    renderRouter(APP_DIR);
    expect(screen.getByTestId('home-battle')).not.toHaveTextContent(/Minta izin orang tua/);
    fireEvent.press(screen.getByTestId('home-battle'));
    expect(screen).toHavePathname('/battle');
    await act(async () => undefined); // the battle screen's own search settles
    await expect(findMatchAsPlayer({ onMessage: () => undefined })).rejects.toThrow(
      'should not connect',
    );
    expect(battleClient.findMatch).toHaveBeenCalled();
  });
});
