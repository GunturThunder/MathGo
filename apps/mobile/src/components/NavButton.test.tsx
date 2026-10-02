import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { NavButton } from './NavButton';

// NavButtons once rendered with no style at all (<Link asChild> dropped the function style);
// this keeps their colours.
function Buttons() {
  return (
    <View>
      <NavButton href="/settings" label="Primary" testID="nav-primary" />
      <NavButton href="/settings" label="Battle" testID="nav-battle" variant="battle" />
      <NavButton href="/settings" label="Secondary" testID="nav-secondary" variant="secondary" />
    </View>
  );
}

describe('NavButton', () => {
  it.each([
    ['nav-primary', colors.blue],
    ['nav-battle', colors.orange],
    ['nav-secondary', colors.white],
  ])('%s has its colour', (testID, backgroundColor) => {
    renderRouter({ index: Buttons, settings: () => null });
    const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);
    expect(style).toMatchObject({ backgroundColor, minHeight: 56 });
  });

  it('navigates', () => {
    renderRouter({ index: Buttons, settings: () => null });
    fireEvent.press(screen.getByTestId('nav-primary'));
    expect(screen).toHavePathname('/settings');
  });
});
