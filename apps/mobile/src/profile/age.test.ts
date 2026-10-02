import { isAdult } from './age';

describe('age rule (mirrors @mathgo/auth)', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  it('adult from the year a player turns 19', () => {
    expect(isAdult(2007, now)).toBe(true);
    expect(isAdult(2008, now)).toBe(false); // 17 or 18 this year: not certainly 18
    expect(isAdult(2014, now)).toBe(false);
    expect(isAdult(1960, now)).toBe(true);
  });
});
