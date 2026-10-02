import { INVITE_ALPHABET, cleanCode, codeFrom } from './invite-code';

describe('invite codes (S4-09)', () => {
  it('the same 31 characters as game-server: no 0, O, 1, I or L', () => {
    expect(INVITE_ALPHABET).toHaveLength(31);
    expect(INVITE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it('typing: upper case, spaces and dashes ignored, at most 6', () => {
    expect(cleanCode('k7m 2q-x')).toEqual({ code: 'K7M2QX', lookAlike: false });
    expect(cleanCode('K7M2QXZZ').code).toBe('K7M2QX');
  });

  it('look-alikes are dropped and flagged, so the screen can explain', () => {
    expect(cleanCode('H4O')).toEqual({ code: 'H4', lookAlike: true });
    expect(cleanCode('1lI0')).toEqual({ code: '', lookAlike: true });
  });

  it('a code from the clipboard: only a whole code counts', () => {
    expect(codeFrom(' h4tpw9 ')).toBe('H4TPW9');
    expect(codeFrom('H4T-PW9')).toBe('H4TPW9');
    expect(codeFrom('H4TPW')).toBeNull();
    expect(codeFrom('H4TPWO')).toBeNull();
    expect(codeFrom('H4TPW9 K7M2QX')).toBeNull(); // two codes: don't guess
  });

  it('a code inside a shared message is found', () => {
    expect(
      codeFrom('Ayo lawan aku di MathBattle! Ketuk Gabung dengan Kode, lalu masukkan: H4TPW9'),
    ).toBe('H4TPW9');
    expect(codeFrom('see you at 7pm, bring snacks')).toBeNull();
  });
});
