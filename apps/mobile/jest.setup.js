/* global jest */
// react-native-mmkv mocks itself under Jest, but imports the Nitro native module first, which
// does not exist in Node. Stub it; the MMKV mock never calls it.
jest.mock('react-native-nitro-modules', () => ({ NitroModules: {} }));
