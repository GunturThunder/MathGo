// Invite codes (S4-08, S4-09): 6 characters from 31 that can't be mistaken for each other when
// read aloud. The same alphabet as game-server's INVITE_ALPHABET.

export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;
const LOOK_ALIKES = /[01OIL]/;

/**
 * What a player typed or pasted, as a code: upper case, spaces and dashes ignored, characters a
 * code never has dropped. `lookAlike` is true when one of 0, O, 1, I or L was typed, so the
 * screen can say codes never use them.
 */
export function cleanCode(raw: string): { code: string; lookAlike: boolean } {
  const upper = raw.toUpperCase().replace(/[\s-]/g, '');
  const code = [...upper]
    .filter((c) => INVITE_ALPHABET.includes(c))
    .join('')
    .slice(0, INVITE_CODE_LENGTH);
  return { code, lookAlike: LOOK_ALIKES.test(upper) };
}

/**
 * A code in copied text (S4-09 paste suggestion): the text is a code by itself, or a message with
 * one code in it, written in capitals as the share message does. Null otherwise.
 */
export function codeFrom(text: string): string | null {
  const alone = text.trim().replace(/[\s-]/g, '').toUpperCase();
  if (alone.length === INVITE_CODE_LENGTH && [...alone].every((c) => INVITE_ALPHABET.includes(c))) {
    return alone;
  }
  const found = [...text.matchAll(/(?:^|[^A-Za-z0-9])([A-HJKMNP-Z2-9]{6})(?![A-Za-z0-9])/g)].map(
    (m) => m[1],
  );
  return found.length === 1 ? (found[0] ?? null) : null;
}
