import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter, screen as routerScreen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BattleEnd } from './components/battle/effects/BattleEnd';
import { useCountUp } from './components/battle/effects/count-up';
import { Matchmaking } from './components/battle/Matchmaking';
import './i18n';
import { reduceMotion } from './motion/reduce-motion';
import { profile } from './profile/store';
import { motion } from './theme';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const inSafeArea = (ui: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

beforeEach(() => {
  reduceMotion.setSystemForTest(false);
  reduceMotion.setInApp(false);
});

describe('Reduce Motion (GF-01)', () => {
  it('is on when the phone says so or the player turns it on, and the switch is kept', () => {
    expect(reduceMotion.isOn()).toBe(false);
    reduceMotion.setInApp(true);
    expect(reduceMotion.isOn()).toBe(true);
    expect(profile.get().reduceMotion).toBe(true);
    reduceMotion.setInApp(false);
    reduceMotion.setSystemForTest(true);
    expect(reduceMotion.isOn()).toBe(true);
  });

  describe('Done when: with Reduce Motion on, a battle plays with no shake, flight or idle loops', () => {
    const win = () =>
      inSafeArea(<BattleEnd outcome="win" reason="ko" onSeeResults={() => undefined} />);

    it('a win: shapes rain normally; with Reduce Motion the card shows without them', () => {
      win();
      expect(screen.getByTestId('confetti')).toBeOnTheScreen();
      screen.unmount();
      reduceMotion.setInApp(true);
      win();
      expect(screen.queryByTestId('confetti')).toBeNull();
      expect(screen.getByTestId('battle-end-title')).toHaveTextContent('K.O.!');
    });

    it('matchmaking: the pulsing rings (an idle loop) stop; the time waited still shows', () => {
      const search = () =>
        inSafeArea(
          <Matchmaking
            trophies={0}
            waitedMs={12_000}
            onCancel={() => undefined}
            onPractice={() => undefined}
          />,
        );
      search();
      // The radar is decoration, hidden from screen readers.
      expect(
        screen.getByTestId('matchmaking-pulse', { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      screen.unmount();
      reduceMotion.setSystemForTest(true);
      search();
      expect(screen.queryByTestId('matchmaking-pulse', { includeHiddenElements: true })).toBeNull();
      expect(screen.getByTestId('matchmaking-waited')).toHaveTextContent('0:12');
    });

    it('counts jump to the result instead of counting up', () => {
      function Count() {
        return <Text testID="count">{useCountUp(280, 310)}</Text>;
      }
      reduceMotion.setInApp(true);
      render(<Count />);
      expect(screen.getByTestId('count')).toHaveTextContent('310');
    });

    it('switching it on mid-battle takes effect at once', () => {
      win();
      expect(screen.getByTestId('confetti')).toBeOnTheScreen();
      act(() => reduceMotion.setSystemForTest(true));
      expect(screen.queryByTestId('confetti')).toBeNull();
    });
  });

  it('the motion tokens keep their limits: the KO hit-stop is the cap, big shake is rare', () => {
    expect(motion.hitStopMs.ko).toBeGreaterThan(motion.hitStopMs.big);
    expect(motion.hitStopMs.big).toBeGreaterThan(motion.hitStopMs.normal);
    expect(motion.shake.ko).toBeGreaterThan(motion.shake.big);
    expect(motion.duration.reducedFade).toBeLessThanOrEqual(150);
    expect(motion.maxFlashesPerSecond).toBeLessThanOrEqual(3);
  });
});

describe('Settings: Reduce Motion switch (GF-01)', () => {
  it('turns it on and off', async () => {
    renderRouter('./src/app', { initialUrl: '/settings' });
    await act(async () => undefined);
    const toggle = routerScreen.getByTestId('settings-reduce-motion');
    expect(toggle.props.value).toBe(false);
    fireEvent(toggle, 'valueChange', true);
    expect(reduceMotion.isOn()).toBe(true);
    expect(routerScreen.getByTestId('settings-reduce-motion').props.value).toBe(true);
  });

  it('shows on and locked when the phone has Reduce Motion on', async () => {
    reduceMotion.setSystemForTest(true);
    renderRouter('./src/app', { initialUrl: '/settings' });
    await act(async () => undefined);
    const toggle = routerScreen.getByTestId('settings-reduce-motion');
    expect(toggle.props.value).toBe(true);
    expect(toggle.props.disabled).toBe(true);
    expect(
      routerScreen.getByText('Menyala karena Kurangi Gerakan di HP ini aktif.'),
    ).toBeOnTheScreen();
  });
});
