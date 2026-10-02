/* global jest */
// react-native-mmkv mocks itself under Jest, but imports the Nitro native module first, which
// does not exist in Node. Stub it; the MMKV mock never calls it.
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));

// No vibration motor in Node.
jest.mock('expo-haptics', () => ({
  selectionAsync: () => Promise.resolve(),
  impactAsync: () => Promise.resolve(),
  notificationAsync: () => Promise.resolve(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

// Font files don't load in Node: report the design's fonts as ready so screens render at once.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  useFonts: () => [true, null],
}));

// Reanimated runs animations on the UI thread through Worklets; in Node they use their mocks.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

// Skia draws natively. Tests check layout and state, not pixels: a canvas is a plain View and
// its drawing elements render nothing.
jest.mock('@shopify/react-native-skia', () => {
  const { View } = jest.requireActual('react-native');
  const nothing = () => null;
  return { Canvas: View, Group: nothing, Path: nothing, Circle: nothing, RoundedRect: nothing };
});
