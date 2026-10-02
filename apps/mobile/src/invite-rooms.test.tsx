import * as battleClient from '@mathgo/battle-client';
import type { ServerMessage } from '@mathgo/protocol';
import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Share } from 'react-native';
import { api } from './api';
import { profile } from './profile/store';
import { colors } from './theme';

const APP_DIR = './src/app';
const thisYear = new Date().getUTCFullYear();

jest.mock('@mathgo/battle-client', () => ({
  ...jest.requireActual('@mathgo/battle-client'),
  findMatch: jest.fn(() => new Promise(() => undefined)),
  createInvite: jest.fn(),
  findInvite: jest.fn(),
  joinBattle: jest.fn(),
}));
const client = jest.mocked(battleClient);

/** A room connection whose server messages the test sends. */
function fakeRoom() {
  let push: (m: ServerMessage) => void = () => undefined;
  const leave = jest.fn(async () => undefined);
  const requestRematch = jest.fn();
  client.joinBattle.mockImplementation(async (_o, handlers) => {
    push = (m) => handlers.onMessage(m);
    return {
      roomId: 'room-1',
      sendAnswer: jest.fn(),
      requestRematch,
      leave,
      devSimulateDrop: jest.fn(),
    };
  });
  return { leave, requestRematch, send: (m: ServerMessage) => act(() => push(m)) };
}

beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  client.createInvite.mockReset();
  client.findInvite.mockReset();
  client.joinBattle.mockReset();
  await Clipboard.setStringAsync('');
  profile.reset();
  profile.setBirthYear(thisYear - 30);
  profile.completeOnboarding();
  jest.spyOn(api, 'session', 'get').mockReturnValue({ accessToken: 'a' } as never);
});
afterEach(() => jest.restoreAllMocks());

describe('create a room (S4-08)', () => {
  beforeEach(() => {
    client.createInvite.mockResolvedValue({
      code: 'K7M2QX',
      roomId: 'room-1',
      expiresAt: '2026-10-02T12:10:00Z',
    });
  });

  it('Done when: the code goes to the share sheet (WhatsApp is in it)', async () => {
    fakeRoom();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    renderRouter(APP_DIR);
    fireEvent.press(screen.getByTestId('home-create-room'));
    await act(async () => undefined);
    expect(screen.getByTestId('invite-code')).toHaveTextContent('K7M2QX');
    expect(screen.getByText('Menunggu temanmu…')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('invite-share'));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('K7M2QX') });
  });

  it('copy puts the code on the clipboard', async () => {
    fakeRoom();
    renderRouter(APP_DIR, { initialUrl: '/battle?mode=create' });
    await act(async () => undefined);
    await act(async () => fireEvent.press(screen.getByTestId('invite-copy')));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('K7M2QX');
    expect(screen.getByText('Tersalin!')).toBeOnTheScreen();
  });

  it('when the friend joins, the battle starts; the result says friendly match', async () => {
    const room = fakeRoom();
    renderRouter(APP_DIR, { initialUrl: '/battle?mode=create' });
    await act(async () => undefined);
    expect(client.joinBattle).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'room-1');
    await startFriendBattle(room);
    expect(screen.getByTestId('battle-screen')).toBeOnTheScreen();
    room.send(drawEnd);
    fireEvent.press(screen.getByTestId('battle-end-results'));
    expect(screen.getByText('Pertandingan teman')).toBeOnTheScreen();
  });

  it('back leaves the room', async () => {
    const room = fakeRoom();
    renderRouter(APP_DIR, { initialUrl: '/battle?mode=create' });
    await act(async () => undefined);
    await act(async () => fireEvent.press(screen.getByTestId('onboarding-back')));
    expect(room.leave).toHaveBeenCalled();
  });
});

describe('join with a code (S4-09)', () => {
  it('Done when: a friend joins in 3 taps from Home (Join with Code, Paste, Join Battle)', async () => {
    fakeRoom();
    await Clipboard.setStringAsync(
      'Ayo lawan aku di MathBattle! Buka aplikasinya, ketuk Gabung dengan Kode, lalu masukkan: K7M2QX',
    );
    client.findInvite.mockResolvedValue({ roomId: 'room-1' });
    renderRouter(APP_DIR);
    let taps = 0;
    const tap = async (id: string) => {
      taps += 1;
      await act(async () => fireEvent.press(screen.getByTestId(id)));
    };
    await tap('home-join-room');
    await tap('join-paste');
    expect(client.findInvite).toHaveBeenCalledWith(expect.anything(), 'K7M2QX');
    expect(screen.getByTestId('join-status')).toHaveTextContent(/Ruang ditemukan/);
    await tap('join-battle');
    expect(taps).toBe(3);
    expect(screen).toHavePathname('/battle');
    expect(client.joinBattle).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'room-1');
  });

  it('typing: lower case is fine, look-alikes are dropped and explained', async () => {
    renderRouter(APP_DIR, { initialUrl: '/join-room' });
    await act(async () => undefined);
    fireEvent.changeText(screen.getByTestId('join-code-input'), 'k7o');
    expect(screen.getByTestId('join-code-input').props.value).toBe('K7');
    expect(screen.getByTestId('join-hint')).toHaveStyle({ color: colors.danger });
    expect(screen.getByTestId('join-battle')).toBeDisabled();
    expect(screen.getByTestId('join-status')).toHaveTextContent(/Masukkan 6 karakter/);
  });

  it.each([
    ['room-not-found', 404, /Tidak ada ruang dengan kode itu/],
    ['room-expired', 410, /Kode itu sudah kedaluwarsa/],
  ] as const)('%s: a clear message, Join stays off', async (code, status, text) => {
    client.findInvite.mockRejectedValue(new battleClient.JoinError(code, status));
    renderRouter(APP_DIR, { initialUrl: '/join-room' });
    await act(async () => fireEvent.changeText(screen.getByTestId('join-code-input'), 'QQQQQQ'));
    expect(screen.getByTestId('join-status')).toHaveTextContent(text);
    expect(screen.getByTestId('join-battle')).toBeDisabled();
  });

  it('a full room is refused at the door, with the reason', async () => {
    client.joinBattle.mockRejectedValue(new battleClient.JoinError('room-full', 409));
    renderRouter(APP_DIR, { initialUrl: '/battle?mode=join&room=room-1' });
    await act(async () => undefined);
    expect(screen.getByTestId('online-error')).toHaveTextContent(/Ruangan itu sudah penuh/);
  });
});

describe('under 18 (S3-09)', () => {
  it('room buttons lead to "Ask a parent", and the join screen redirects', () => {
    profile.setBirthYear(thisYear - 10);
    jest.spyOn(api, 'session', 'get').mockReturnValue(null);
    renderRouter(APP_DIR);
    fireEvent.press(screen.getByTestId('home-create-room'));
    expect(screen).toHavePathname('/ask-parent');
    screen.unmount();
    renderRouter(APP_DIR, { initialUrl: '/join-room' });
    expect(screen).toHavePathname('/ask-parent');
    expect(client.createInvite).not.toHaveBeenCalled();
    expect(client.findInvite).not.toHaveBeenCalled();
  });
});

const drawEnd: ServerMessage = {
  type: 'end',
  payload: {
    result: { outcome: 'draw', reason: 'time' },
    stats: [
      { correct: 0, wrong: 0, bestStreak: 0 },
      { correct: 0, wrong: 0, bestStreak: 0 },
    ],
    trophies: null,
  },
};

async function startFriendBattle(room: ReturnType<typeof fakeRoom>) {
  room.send({ type: 'joined', payload: { seat: 0, arena: 2, durationMs: 90_000 } });
  room.send({ type: 'questions', payload: { questions: [{ index: 0, text: '12 + 9' }] } });
}

describe('rematch in a friend room (S4-13)', () => {
  beforeEach(() => {
    client.createInvite.mockResolvedValue({
      code: 'K7M2QX',
      roomId: 'room-1',
      expiresAt: '2026-10-02T12:10:00Z',
    });
  });

  async function finished() {
    const room = fakeRoom();
    renderRouter(APP_DIR, { initialUrl: '/battle?mode=create' });
    await act(async () => undefined);
    await startFriendBattle(room);
    room.send(drawEnd);
    return room;
  }

  it('Done when: I offer, and see my friend’s answer; a rematch starts when both say yes', async () => {
    const room = await finished();
    expect(screen.getByTestId('battle-end-rematch')).toHaveTextContent(
      'Main lagi dimulai saat kalian berdua menekannya.',
    );
    fireEvent.press(screen.getByTestId('battle-end-again'));
    expect(room.requestRematch).toHaveBeenCalledWith(true);
    room.send({ type: 'rematch', payload: { seat: 0, accepted: true } });
    expect(screen.getByTestId('battle-end-rematch')).toHaveTextContent('Menunggu jawaban temanmu…');
    expect(screen.getByTestId('battle-end-again')).toBeDisabled();
    // The friend says yes: the server starts the next battle in the same room.
    room.send({ type: 'rematch', payload: { seat: 1, accepted: true } });
    room.send({ type: 'joined', payload: { seat: 0, arena: 2, durationMs: 90_000 } });
    room.send({ type: 'countdown', payload: { startsInMs: 3_000 } });
    expect(screen.queryByTestId('battle-end')).toBeNull();
    expect(screen.getByTestId('online-countdown')).toBeOnTheScreen();
    expect(screen.getByTestId('fighter-rival-hp')).toHaveTextContent('100');
  });

  it('Done when: my friend offers first, and I see it, on the results too', async () => {
    const room = await finished();
    fireEvent.press(screen.getByTestId('battle-end-results'));
    room.send({ type: 'rematch', payload: { seat: 1, accepted: true } });
    expect(screen.getByTestId('result-rematch')).toHaveTextContent('Temanmu mau main lagi!');
    fireEvent.press(screen.getByTestId('result-again'));
    expect(room.requestRematch).toHaveBeenCalledWith(true);
  });

  it('my friend left: said plainly, and play again is off', async () => {
    const room = await finished();
    room.send({ type: 'rematch', payload: { seat: 1, accepted: false } });
    expect(screen.getByTestId('battle-end-rematch')).toHaveTextContent(
      'Temanmu sudah keluar dari ruang.',
    );
    expect(screen.getByTestId('battle-end-again')).toBeDisabled();
  });

  it('random battles: play again still means a new search, no rematch line', async () => {
    let push: (m: ServerMessage) => void = () => undefined;
    client.findMatch.mockImplementation(async (_o, h) => {
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
    renderRouter(APP_DIR, { initialUrl: '/battle' });
    await act(async () => undefined);
    act(() => push({ type: 'joined', payload: { seat: 0, arena: 1, durationMs: 90_000 } }));
    act(() => push({ type: 'questions', payload: { questions: [{ index: 0, text: '1 + 1' }] } }));
    act(() => push(drawEnd));
    expect(screen.queryByTestId('battle-end-rematch')).toBeNull();
    expect(screen.getByTestId('battle-end-again')).toBeEnabled();
  });
});
