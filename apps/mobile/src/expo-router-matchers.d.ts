// expo-router/testing-library registers these Jest matchers but ships no types for them.
declare global {
  namespace jest {
    interface Matchers<R> {
      toHavePathname(pathname: string): R;
      toHaveSegments(segments: string[]): R;
    }
  }
}

export {};
