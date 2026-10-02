import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { api } from './api';
import { queryClient } from './api/queries';
import { i18n } from './i18n';
import { profile } from './profile/store';

const APP_DIR = './src/app';
const ME = { id: 'u1', nickname: 'RusaLincah42', birthYear: 1995, trophies: 0, online: true };
const thisYear = new Date().getUTCFullYear();

let signUp: jest.SpyInstance;
let setNickname: jest.SpyInstance;
let nicknames: jest.SpyInstance;

beforeEach(() => {
  profile.reset();
  queryClient.clear();
  api.signOut();
  void i18n.changeLanguage('id');
  nicknames = jest
    .spyOn(api, 'nicknames')
    .mockResolvedValue({ nicknames: ['RusaLincah42', 'KancilKilat7'] });
  signUp = jest.spyOn(api, 'signUpGuest').mockResolvedValue({} as never);
  setNickname = jest.spyOn(api, 'setNickname').mockResolvedValue(ME as never);
});
afterEach(() => jest.restoreAllMocks());

/** Welcome → language → birth year, picking `year` on the right page of the grid. */
function toBirthYear() {
  renderRouter(APP_DIR);
  expect(screen.getByTestId('welcome')).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('welcome-start'));
  fireEvent.press(screen.getByTestId('onboarding-continue'));
  expect(screen.getByTestId('onboarding-birth-year')).toBeOnTheScreen();
}
function pickYear(year: number) {
  while (screen.queryByTestId(`year-${year}`) === null)
    fireEvent.press(screen.getByTestId('years-earlier'));
  fireEvent.press(screen.getByTestId(`year-${year}`));
}

describe('first launch (S3-08)', () => {
  it('a new install opens on Welcome, not Home', () => {
    renderRouter(APP_DIR);
    expect(screen.getByTestId('welcome')).toBeOnTheScreen();
    expect(screen.queryByTestId('home-battle')).toBeNull();
  });

  it('picking a language switches the app at once and is kept', () => {
    renderRouter(APP_DIR);
    fireEvent.press(screen.getByTestId('welcome-start'));
    expect(screen.getByText('Pilih bahasa')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('onboarding-language-en'));
    expect(screen.getByText('Choose your language')).toBeOnTheScreen();
    expect(profile.get().language).toBe('en');
  });

  it('no birth year is picked for the player: Continue waits for one', () => {
    toBirthYear();
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();
    pickYear(thisYear - 30);
    expect(screen.getByTestId('birth-year-picked')).toHaveTextContent(String(thisYear - 30));
    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();
  });

  it('Done when: an adult reaches Home in 3 taps or fewer after the birth year', async () => {
    toBirthYear();
    pickYear(thisYear - 30);
    let taps = 0;
    const tap = (id: string) => {
      taps += 1;
      fireEvent.press(screen.getByTestId(id));
    };
    tap('onboarding-continue');
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-nickname')).toHaveTextContent('RusaLincah42'),
    );
    tap('onboarding-go');
    await waitFor(() => expect(screen.getByTestId('home-battle')).toBeOnTheScreen());
    expect(taps).toBeLessThanOrEqual(3);
    expect(signUp).toHaveBeenCalledWith(thisYear - 30);
    expect(setNickname).toHaveBeenCalledWith('RusaLincah42');
    expect(profile.get()).toMatchObject({ birthYear: thisYear - 30, onboarded: true });
  });

  it('the dice offers the next generated name', async () => {
    toBirthYear();
    pickYear(thisYear - 30);
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-nickname')).toHaveTextContent('RusaLincah42'),
    );
    fireEvent.press(screen.getByLabelText('Beri aku nama lain'));
    expect(screen.getByTestId('onboarding-nickname')).toHaveTextContent('KancilKilat7');
    fireEvent.press(screen.getByTestId('onboarding-go'));
    await waitFor(() => expect(setNickname).toHaveBeenCalledWith('KancilKilat7'));
  });

  it('the year a player turns 18 still counts as under 18 (the server rule): Home, no account', async () => {
    toBirthYear();
    pickYear(thisYear - 18);
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() => expect(screen.getByTestId('home-battle')).toBeOnTheScreen());
    expect(signUp).not.toHaveBeenCalled();
    expect(nicknames).not.toHaveBeenCalled();
    expect(profile.get()).toMatchObject({ birthYear: thisYear - 18, onboarded: true });
  });

  it('offline: a clear message, Try again, or practise without an account', async () => {
    nicknames.mockRejectedValueOnce(new TypeError('Network request failed'));
    toBirthYear();
    pickYear(thisYear - 30);
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() => expect(screen.getByTestId('onboarding-error')).toBeOnTheScreen());
    expect(screen.getByTestId('onboarding-error')).toHaveTextContent(/^Tidak bisa terhubung/);
    await act(async () => fireEvent.press(screen.getByTestId('onboarding-retry')));
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-nickname')).toHaveTextContent('RusaLincah42'),
    );
  });

  it('offline: skipping opens Home without an account', async () => {
    nicknames.mockRejectedValue(new TypeError('Network request failed'));
    toBirthYear();
    pickYear(thisYear - 30);
    fireEvent.press(screen.getByTestId('onboarding-continue'));
    await waitFor(() => expect(screen.getByTestId('onboarding-skip')).toBeOnTheScreen());
    fireEvent.press(screen.getByTestId('onboarding-skip'));
    await waitFor(() => expect(screen.getByTestId('home-battle')).toBeOnTheScreen());
    expect(signUp).not.toHaveBeenCalled();
  });

  it('after the first launch the app opens on Home', () => {
    profile.completeOnboarding();
    renderRouter(APP_DIR);
    expect(screen.getByTestId('home-battle')).toBeOnTheScreen();
  });
});
