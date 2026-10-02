/**
 * The phone's monotonic clock in ms, for battle timing. One place, so tests can drive it
 * (`jest.mock('./lib/clock')`): React Native's Jest preset replaces `performance` with its own.
 */
export function clockNow(): number {
  return performance.now();
}
