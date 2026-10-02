import { renderRouter, screen } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';
import { profile } from '../profile/store';
import { colors } from '../theme';

// The Home buttons once rendered with no style at all (<Link asChild> dropped the function
// style); this keeps their colours.
describe('NavButton', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    profile.completeOnboarding();
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['home-battle', colors.orange],
    ['home-practice', colors.blue],
    ['home-settings', colors.white],
  ])('%s has its colour', (testID, backgroundColor) => {
    renderRouter('./src/app');
    const style = StyleSheet.flatten(screen.getByTestId(testID).props.style);
    expect(style).toMatchObject({ backgroundColor, minHeight: 56 });
  });
});
