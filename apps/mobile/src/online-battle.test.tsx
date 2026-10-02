import * as battleClient from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { api } from './api';
import { profile } from './profile/store';
import { setDevPretendOldVersion } from './net/update-required';

const APP_DIR = './src/app';
const thisYear = new Date().getUTCFullYear();
const findMatch = jest.mocked(battleClient.findMatch);

/** A fake game-server: the test pushes messages; the app's answers are recorded. */
function fakeServer() {
  let push: (m: ServerMessage) => void = () => undefined;
  let resolveMatch: (c: battleClient.BattleConnection) => void = () => undefined;
  const sendAnswer = jest.fn();
  const cancel = jest.fn(async () => undefined);
  const leave = jest.fn(async () => undefined);
  findMatch.mockImplementation(async (_options, handlers) => {
    push = (m) => handlers.onMessage(m);
    return {
      match: new Promise((resolve) => (resolveMatch = resolve)),
      cancel,
    };
  });
  return {
    sendAnswer,
    cancel,
    leave,
    matched: () =>
      act(async () => resolveMatch({ roomId: 'r1', sendAnswer, requestRematch: jest.fn(), leave })),
    send: (m: ServerMessage) => act(() => push(m)),
  };
}

const player = (hp: number, questionIndex = 0) => ({
  hp,
  streak: 0,
  comboReady: false,
  lockedUntil: 0,
  questionIndex,
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  setDevPretendOldVersion(false);
  findMatch.mockReset();
  profile.reset();
  profile.setBirthYear(thisYear - 30);
  profile.completeOnboarding();
  // An account already exists: no sign-up call.
  jest.spyOn(api, 'session', 'get').mockReturnValue({ accessToken: 'a' } as never);
});
afterEach(() => jest.restoreAllMocks());

async function startBattle() {
  const server = fakeServer();
  renderRouter(APP_DIR, { initialUrl: '/battle' });
  await act(async () => undefined);
  expect(screen.getByTestId('online-searching')).toBeOnTheScreen();
  await server.matched();
  server.send({ type: 'joined', payload: { seat: 0, arena: 1, durationMs: 90_000 } });
  server.send({
    type: 'questions',
    payload: {
      questions: [
        { index: 0, text: '3 + 4' },
        { index: 1, text: '9 − 2' },
      ],
    },
  });
  return server;
}

describe('online battle screen (S3-12)', () => {
  it('searching, then the battle screen shows the server’s question', async () => {
    await startBattle();
    expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('question')).toHaveTextContent('3 + 4');
    expect(screen.getByText('Lawan')).toBeOnTheScreen();
  });

  it('the app sends the typed answer; the server decides what happens', async () => {
    const server = await startBattle();
    fireEvent(screen.getByTestId('key-7'), 'pressIn');
    fireEvent.press(screen.getByTestId('key-submit'));
    expect(server.sendAnswer).toHaveBeenCalledWith(0, 7);
    // Nothing changes until the server says so.
    expect(screen.getByTestId('fighter-rival-hp')).toHaveTextContent('100');
    server.send({
      type: 'state',
      payload: {
        now: 2_000,
        players: [player(100, 1), player(85)],
        events: [
          {
            type: 'hit',
            seat: 0,
            questionIndex: 0,
            damage: 15,
            speedBonus: true,
            combo: false,
            targetHp: 85,
          },
        ],
      },
    });
    expect(screen.getByTestId('fighter-rival-hp')).toHaveTextContent('85');
    expect(screen.getByTestId('question')).toHaveTextContent('9 − 2');
    expect(screen.getByTestId('hit-burst')).toHaveTextContent('−15');
  });

  it('Done when (end to end): the end card, then the results from the server stats', async () => {
    const server = await startBattle();
    server.send({
      type: 'state',
      payload: { now: 50_000, players: [player(100, 10), player(0, 4)], events: [] },
    });
    server.send({
      type: 'end',
      payload: {
        result: { outcome: 'win', winner: 0, reason: 'ko' },
        stats: [
          { correct: 10, wrong: 1, bestStreak: 6 },
          { correct: 3, wrong: 2, bestStreak: 2 },
        ],
        trophies: null,
      },
    });
    expect(screen.getByTestId('battle-end-title')).toHaveTextContent('K.O.!');
    fireEvent.press(screen.getByTestId('battle-end-results'));
    expect(screen.getByTestId('result-title')).toHaveTextContent('Menang!');
    expect(screen.getByText('Pertarungan peringkat')).toBeOnTheScreen();
    expect(screen.getByTestId('result-answers')).toHaveTextContent(/^10\/11/);
  });

  it('Cancel while searching leaves the queue', async () => {
    const server = fakeServer();
    renderRouter(APP_DIR, { initialUrl: '/battle' });
    await act(async () => undefined);
    await act(async () => fireEvent.press(screen.getByTestId('online-cancel')));
    expect(server.cancel).toHaveBeenCalled();
  });

  it('a refused join shows the reason in the player’s language, with Try again', async () => {
    findMatch.mockRejectedValue(new battleClient.JoinError('already-in-match', 409));
    renderRouter(APP_DIR, { initialUrl: '/battle' });
    await act(async () => undefined);
    expect(screen.getByTestId('online-error')).toHaveTextContent(
      /Kamu masih di tengah pertarungan/,
    );
    findMatch.mockReset();
    fakeServer();
    await act(async () => fireEvent.press(screen.getByTestId('online-retry')));
    expect(screen.getByTestId('online-searching')).toBeOnTheScreen();
  });
});
