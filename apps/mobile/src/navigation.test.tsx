import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

// Route tests live outside src/app, where every file would become a screen.
const APP_DIR = './src/app';

describe('app shell', () => {
  // Settings logs the S1-08 check; keep test output clean and assert on it instead.
  let log: jest.SpyInstance;
  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  it('opens on Home with a button for every screen', () => {
    renderRouter(APP_DIR);
    expect(screen).toHavePathname('/');
    expect(screen.getByTestId('home-battle')).toBeOnTheScreen();
    expect(screen.getByTestId('home-practice')).toBeOnTheScreen();
    expect(screen.getByTestId('home-settings')).toBeOnTheScreen();
  });

  it.each([
    ['home-battle', '/battle'],
    ['home-practice', '/practice'],
    ['home-settings', '/settings'],
  ])('%s opens %s', (testID, pathname) => {
    renderRouter(APP_DIR);
    fireEvent.press(screen.getByTestId(testID));
    expect(screen).toHavePathname(pathname);
  });

  it('Settings shows and logs the game-core check', () => {
    renderRouter(APP_DIR, { initialUrl: '/settings' });
    expect(screen.getByTestId('determinism-status')).toHaveTextContent('PASS');
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[S1-08\] PASS /));
  });
});
