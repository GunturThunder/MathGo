/** @type {import('jest').Config} */
export default {
  preset: 'jest-expo',
  // pnpm keeps packages under node_modules/.pnpm, so it must be transformed like the others.
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|standard-navigation))',
  ],
};
