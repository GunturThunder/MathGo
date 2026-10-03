import * as battleClient from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { api } from './api';
import { queryClient } from './api/queries';
import { profile } from './profile/store';
import { arenaThemes } from './theme';

const APP_DIR = './src/app';
const thisYear = new Date().getUTCFullYear();
const me = (trophies: number) => ({
  id: 'u1',
  nickname: 'SwiftComet27',
  birthYear: 1995,
  trophies,
  online: true,
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  queryClient.clear();
  profile.reset();
  profile.setBirthYear(thisYear - 30);
  profile.completeOnboarding();
  jest.spyOn(api, 'session', 'get').mockReturnValue({ accessToken: 'a', user: me(0) } as never);
});
afterEach(() => jest.restoreAllMocks());

describe('Home (S5-06)', () => {
  it('shows the player, their trophies, arena and progress (design: 842 in Times Tower)', async () => {
    jest.spyOn(api, 'me').mockResolvedValue(me(842));
    renderRouter(APP_DIR);
    await waitFor(() =>
      expect(screen.getByTestId('home-arena-line')).toHaveTextContent('Arena 3 · Times Tower'),
    );
    expect(screen.getByTestId('home-name')).toHaveTextContent('SwiftComet27');
    expect(screen.getByTestId('home-trophies')).toHaveTextContent('842');
    expect(screen.getByTestId('home-progress')).toHaveTextContent('842 / 1.200 · 358 lagi');
    expect(screen.getByTestId('home-battle')).toHaveTextContent(/Lawan acak dekat 842 trofi/);
  });

  it('the top arena says so instead of a next target', async () => {
    jest.spyOn(api, 'me').mockResolvedValue(me(2_050));
    renderRouter(APP_DIR);
    await waitFor(() =>
      expect(screen.getByTestId('home-progress')).toHaveTextContent('2.050 · arena tertinggi'),
    );
  });

  it('before the server answers (or offline), the last session’s numbers show', () => {
    jest.spyOn(api, 'me').mockReturnValue(new Promise(() => undefined));
    jest.spyOn(api, 'session', 'get').mockReturnValue({ accessToken: 'a', user: me(500) } as never);
    renderRouter(APP_DIR);
    expect(screen.getByTestId('home-trophies')).toHaveTextContent('500');
    expect(screen.getByTestId('home-arena-line')).toHaveTextContent(/Plus Plains/);
  });

  it.each([
    [150, 1],
    [500, 2],
    [842, 3],
    [1_500, 4],
    [2_050, 5],
  ] as const)(
    'S5-10: %i trophies paint the arena card in arena %i’s colour',
    async (trophies, arena) => {
      jest.spyOn(api, 'me').mockResolvedValue(me(trophies));
      renderRouter(APP_DIR);
      await waitFor(() =>
        expect(screen.getByTestId('home-arena')).toHaveStyle({
          backgroundColor: arenaThemes[arena].card,
        }),
      );
    },
  );

  it('the profile shape opens Settings; practice is one tap away', async () => {
    jest.spyOn(api, 'me').mockResolvedValue(me(0));
    renderRouter(APP_DIR);
    await act(async () => undefined);
    fireEvent.press(screen.getByLabelText('Profil dan pengaturan'));
    expect(screen).toHavePathname('/settings');
  });

  it('Done when: trophies and arena update after a ranked battle', async () => {
    // After the battle the server never answers: the new numbers must come from the battle's end.
    const meCall = jest
      .spyOn(api, 'me')
      .mockResolvedValueOnce(me(690))
      .mockReturnValue(new Promise(() => undefined));
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
    renderRouter(APP_DIR);
    await waitFor(() =>
      expect(screen.getByTestId('home-arena-line')).toHaveTextContent(/Plus Plains/),
    );

    fireEvent.press(screen.getByTestId('home-battle'));
    await act(async () => undefined);
    act(() => push({ type: 'joined', payload: { seat: 0, arena: 2, durationMs: 90_000 } }));
    act(() => push({ type: 'questions', payload: { questions: [{ index: 0, text: '2 + 2' }] } }));
    await act(async () =>
      push({
        type: 'end',
        payload: {
          result: { outcome: 'win', winner: 0, reason: 'ko' },
          stats: [
            { correct: 8, wrong: 0, bestStreak: 8 },
            { correct: 1, wrong: 3, bestStreak: 1 },
          ],
          trophies: [
            { delta: 30, trophies: 720, arenaBefore: 2, arenaAfter: 3 },
            { delta: -20, trophies: 660, arenaBefore: 2, arenaAfter: 2 },
          ],
        },
      }),
    );
    fireEvent.press(screen.getByTestId('battle-end-results'));
    // Times Tower just opened (S5-08): close it, then go Home.
    fireEvent.press(screen.getByTestId('result-unlock-ok'));
    await act(async () => fireEvent.press(screen.getByTestId('result-home')));
    expect(screen).toHavePathname('/');
    await waitFor(() => expect(screen.getByTestId('home-trophies')).toHaveTextContent('720'));
    expect(screen.getByTestId('home-arena-line')).toHaveTextContent('Arena 3 · Times Tower');
    expect(meCall.mock.calls.length).toBeGreaterThanOrEqual(2); // and it asks the server to confirm
  });
});
