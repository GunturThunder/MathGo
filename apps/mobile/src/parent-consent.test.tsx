import * as battleClient from '@mathgo/battle-client';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { api } from './api';
import { queryClient } from './api/queries';
import { consentFlow } from './profile/consent-flow';
import { onlineLocked } from './profile/online';
import { profile } from './profile/store';

const APP_DIR = './src/app';
const thisYear = new Date().getUTCFullYear();
const CHILD_YEAR = thisYear - 10;

const child = (nickname: string) => ({
  id: 'kid-1',
  nickname,
  birthYear: CHILD_YEAR,
  trophies: 0,
  online: true,
});

/** Just enough of apps/api's consent endpoints (S5-05), with one right code. */
function fakeApi({ rightCode = '482916' } = {}) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  let wrongLeft = 5;
  let nickname = 'Penyu Tekun';
  const reply = (status: number, json: unknown) =>
    ({ ok: status < 400, status, json: async () => json }) as Response;
  const error = (status: number, code: string, extra: object = {}) =>
    reply(status, { error: { code, message: code, requestId: 'r', ...extra } });
  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
  jest.spyOn(globalThis, 'fetch').mockImplementation((async (url: string, init?: RequestInit) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '');
    const body = init?.body === undefined ? {} : JSON.parse(String(init.body));
    calls.push({ path, body });
    if (path === '/consent/start') {
      if (!String(body.email).includes('@')) return error(400, 'invalid-email');
      return reply(201, {
        consentId: 'c1',
        email: 'ay•••••••@gmail.com',
        expiresAt: inMinutes(5),
        resendAt: inMinutes(1),
      });
    }
    if (path === '/consent/verify') {
      if (body.code !== rightCode) {
        wrongLeft -= 1;
        return wrongLeft > 0
          ? error(400, 'wrong-code', { attemptsLeft: wrongLeft })
          : error(429, 'code-locked', { retryAt: inMinutes(15) });
      }
      return reply(201, {
        accessToken: 'access-kid',
        accessTokenExpiresAt: inMinutes(15),
        refreshToken: 'refresh-kid',
        refreshTokenExpiresAt: inMinutes(60 * 24 * 30),
        user: child(nickname),
      });
    }
    if (path.startsWith('/nicknames')) return reply(200, { nicknames: ['Kancil Gesit'] });
    if (path === '/me/nickname') {
      nickname = String(body.nickname);
      return reply(200, child(nickname));
    }
    if (path === '/me') return reply(200, child(nickname));
    return error(404, 'not-found');
  }) as typeof fetch);
  return { calls };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  queryClient.clear();
  consentFlow.clear();
  api.signOut();
  profile.reset();
  profile.setBirthYear(CHILD_YEAR);
  profile.completeOnboarding();
  jest.mocked(battleClient.findMatch).mockClear();
});
afterEach(() => jest.restoreAllMocks());

async function openEmailScreen() {
  renderRouter(APP_DIR, { initialUrl: '/ask-parent' });
  await act(async () => fireEvent.press(screen.getByTestId('ask-parent-ask')));
  expect(screen).toHavePathname('/parent/email');
}

async function sendCode(email = 'Ayah.Budi@gmail.com') {
  fireEvent.changeText(screen.getByTestId('parent-email-input'), email);
  fireEvent.press(screen.getByTestId('parent-agree'));
  await act(async () => fireEvent.press(screen.getByTestId('parent-send')));
}

const typeCode = (code: string) =>
  fireEvent.changeText(screen.getByTestId('parent-code-input'), code);

describe('parent consent screens (S5-09)', () => {
  it('Done when: an under-18 player goes from "Ask a parent" to a random battle', async () => {
    const { calls } = fakeApi();
    expect(onlineLocked()).toBe(true);
    await openEmailScreen();
    await sendCode();
    expect(calls.at(-1)).toEqual({
      path: '/consent/start',
      body: { email: 'Ayah.Budi@gmail.com', birthYear: CHILD_YEAR },
    });
    expect(screen).toHavePathname('/parent/code');
    expect(screen.getByTestId('parent-code')).toHaveTextContent(/Dikirim ke ay•••••••@gmail\.com/);
    expect(screen.getByTestId('parent-code-status')).toHaveTextContent(/sisa 5:00|sisa 4:59/);

    // A wrong code first: the boxes say so, with the tries left.
    typeCode('111111');
    await act(async () => fireEvent.press(screen.getByTestId('parent-unlock')));
    expect(screen.getByTestId('parent-code-status')).toHaveTextContent(
      'Kode tidak cocok. 4 kesempatan lagi.',
    );

    // The right one unlocks online play.
    typeCode('482916');
    await act(async () => fireEvent.press(screen.getByTestId('parent-unlock')));
    expect(screen).toHavePathname('/parent/done');
    expect(screen.getByTestId('parent-done')).toHaveTextContent(/Pertarungan online terbuka!/);
    expect(onlineLocked()).toBe(false);
    expect(api.session?.user.online).toBe(true);

    // Then the battle name (only now, decided Oct 1), Home, and a random battle.
    await act(async () => fireEvent.press(screen.getByTestId('parent-go')));
    expect(screen).toHavePathname('/onboarding/name');
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-nickname')).toHaveTextContent('Kancil Gesit'),
    );
    await act(async () => fireEvent.press(screen.getByTestId('onboarding-go')));
    expect(screen).toHavePathname('/');
    await waitFor(() => expect(screen.getByTestId('home-name')).toHaveTextContent('Kancil Gesit'));
    await act(async () => fireEvent.press(screen.getByTestId('home-battle')));
    expect(screen).toHavePathname('/battle');
    expect(screen.getByTestId('matchmaking')).toBeOnTheScreen();
    expect(battleClient.findMatch).toHaveBeenCalled();
  });

  it('Send Code waits for an email and the parent’s agreement', async () => {
    fakeApi();
    await openEmailScreen();
    const send = screen.getByTestId('parent-send');
    expect(send).toBeDisabled();
    fireEvent.changeText(screen.getByTestId('parent-email-input'), 'ayah@gmail');
    fireEvent.press(screen.getByTestId('parent-agree'));
    expect(send).toBeDisabled();
    fireEvent.changeText(screen.getByTestId('parent-email-input'), 'ayah@gmail.com');
    expect(send).toBeEnabled();
    fireEvent.press(screen.getByTestId('parent-agree'));
    expect(send).toBeDisabled();
  });

  it('the 6th wrong code shows the block, with the 15-minute wait', async () => {
    fakeApi();
    await openEmailScreen();
    await sendCode();
    for (let i = 0; i < 5; i++) {
      typeCode('000000');
      await act(async () => fireEvent.press(screen.getByTestId('parent-unlock')));
    }
    expect(screen.getByTestId('parent-code-status')).toHaveTextContent(
      /Terlalu banyak kode salah.*Minta kode baru dalam (15:00|14:59)/,
    );
    expect(screen.getByTestId('parent-unlock')).toBeDisabled();
    expect(screen.getByTestId('parent-resend')).toBeDisabled();
    expect(onlineLocked()).toBe(true);
  });

  it('resend opens after a minute and sends a new code to the same address', async () => {
    const { calls } = fakeApi();
    await openEmailScreen();
    await sendCode();
    expect(screen.getByTestId('parent-resend')).toBeDisabled();
    expect(screen.getByTestId('parent-code')).toHaveTextContent(/kirim ulang dalam (1:00|0:59)/);
    const later = Date.now() + 61_000;
    jest.spyOn(Date, 'now').mockReturnValue(later);
    // The screen's clock ticks every second.
    await waitFor(() => expect(screen.getByTestId('parent-resend')).toBeEnabled(), {
      timeout: 2_000,
    });
    await act(async () => fireEvent.press(screen.getByTestId('parent-resend')));
    expect(calls.filter((c) => c.path === '/consent/start')).toHaveLength(2);
    expect(calls.at(-1)?.body).toMatchObject({ email: 'Ayah.Budi@gmail.com' });
    expect(screen.getByTestId('parent-code-status')).toHaveTextContent('Kode baru sudah dikirim.');
  });

  it('the address is not kept once online play is unlocked', async () => {
    fakeApi();
    await openEmailScreen();
    await sendCode();
    expect(consentFlow.get()?.email).toBe('Ayah.Budi@gmail.com');
    typeCode('482916');
    await act(async () => fireEvent.press(screen.getByTestId('parent-unlock')));
    expect(consentFlow.get()).toBeNull();
  });

  it('without a code on its way, the code screen goes back to the email', async () => {
    fakeApi();
    renderRouter(APP_DIR, { initialUrl: '/parent/code' });
    await act(async () => undefined);
    expect(screen).toHavePathname('/parent/email');
  });
});
