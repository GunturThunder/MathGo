import * as battleClient from '@mathgo/battle-client';
import { PROTOCOL_VERSION } from '@mathgo/protocol';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Linking, Platform } from 'react-native';
import { findMatchAsPlayer } from './net/battle';
import { storeUrl } from './net/store-link';
import { setDevPretendOldVersion, updateRequired } from './net/update-required';
import { profile } from './profile/store';

const APP_DIR = './src/app';
const thisYear = new Date().getUTCFullYear();
const refuse = () => Promise.reject(new battleClient.JoinError('update-required', 426));

jest.mock('@mathgo/battle-client', () => ({
  ...jest.requireActual('@mathgo/battle-client'),
  findMatch: jest.fn(),
}));
const findMatch = jest.mocked(battleClient.findMatch);

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  setDevPretendOldVersion(false); // also forgets an earlier refusal
  findMatch.mockReset();
  profile.reset();
  profile.setBirthYear(thisYear - 30);
  profile.completeOnboarding();
});
afterEach(() => jest.restoreAllMocks());

describe('update required (S4-12)', () => {
  it('a refusal is remembered for this version, and not asked again', async () => {
    findMatch.mockImplementation(refuse);
    await expect(findMatchAsPlayer({ onMessage: () => undefined })).rejects.toMatchObject({
      code: 'update-required',
    });
    expect(updateRequired()).toBe(true);
    await expect(findMatchAsPlayer({ onMessage: () => undefined })).rejects.toMatchObject({
      code: 'update-required',
    });
    expect(findMatch).toHaveBeenCalledTimes(1);
  });

  it('Done when: after a refusal, Battle shows the update screen with a store link', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    findMatch.mockImplementation(refuse);
    await findMatchAsPlayer({ onMessage: () => undefined }).catch(() => undefined);
    renderRouter(APP_DIR);
    fireEvent.press(screen.getByTestId('home-battle'));
    expect(screen).toHavePathname('/update-required');
    expect(screen.getByText('Saatnya update!')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('update-now'));
    await waitFor(() => expect(open).toHaveBeenCalledWith('market://details?id=com.mathgo.app'));
  });

  it('the store page is the Play Store listing; no link on iOS until there is a listing', () => {
    expect(storeUrl('android')).toBe(
      'https://play.google.com/store/apps/details?id=com.mathgo.app',
    );
    expect(storeUrl('ios')).toBeNull();
  });

  it('practice still works from the update screen', () => {
    findMatch.mockImplementation(refuse);
    renderRouter(APP_DIR, { initialUrl: '/update-required' });
    fireEvent.press(screen.getByTestId('update-practice'));
    expect(screen).toHavePathname('/practice');
  });

  it('the online battle route redirects once refused', async () => {
    findMatch.mockImplementation(refuse);
    await findMatchAsPlayer({ onMessage: () => undefined }).catch(() => undefined);
    renderRouter(APP_DIR, { initialUrl: '/battle' });
    expect(screen).toHavePathname('/update-required');
  });

  it('dev switch: sends an old protocol version; turning it off forgets the refusal', async () => {
    findMatch.mockImplementation(refuse);
    setDevPretendOldVersion(true);
    await findMatchAsPlayer({ onMessage: () => undefined }).catch(() => undefined);
    expect(findMatch.mock.calls[0]?.[0]).toMatchObject({ protocolVersion: PROTOCOL_VERSION - 1 });
    expect(updateRequired()).toBe(true);
    setDevPretendOldVersion(false);
    expect(updateRequired()).toBe(false);
  });

  it('a current app is not sent to the update screen', () => {
    renderRouter(APP_DIR);
    fireEvent.press(screen.getByTestId('home-battle'));
    expect(screen).toHavePathname('/battle');
  });
});
