import { getArena, type ArenaId } from '@mathgo/game-core';

// What the player has typed on the keypad (S2-07). The app only collects the number; the server
// (or the local engine in practice) decides whether it is right.

export interface AnswerEntry {
  /** Digits as typed, no sign, no leading zeros. */
  readonly digits: string;
  readonly negative: boolean;
}

export type KeypadKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'delete' | 'sign';

export const EMPTY_ENTRY: AnswerEntry = { digits: '', negative: false };

/** Room for the longest answer the arena allows: 2 digits in Counting Camp, 4 in Power Peak. */
export function maxDigits(arena: ArenaId): number {
  const { min, max } = getArena(arena).answer;
  return String(Math.max(Math.abs(min), Math.abs(max))).length;
}

/** Only Power Peak has negative answers, so only it gets the ± key (PRD). */
export function allowsNegative(arena: ArenaId): boolean {
  return getArena(arena).answer.min < 0;
}

export function pressKey(entry: AnswerEntry, key: KeypadKey, arena: ArenaId): AnswerEntry {
  if (key === 'sign') {
    return allowsNegative(arena) ? { ...entry, negative: !entry.negative } : entry;
  }
  if (key === 'delete') {
    if (entry.digits === '') return entry.negative ? EMPTY_ENTRY : entry;
    return { ...entry, digits: entry.digits.slice(0, -1) };
  }
  // A lone 0 is replaced by the next digit, so "05" can't be typed.
  if (entry.digits === '0') return { ...entry, digits: key };
  if (entry.digits.length >= maxDigits(arena)) return entry;
  return { ...entry, digits: entry.digits + key };
}

/** The number to send, or null while nothing is typed. */
export function entryValue(entry: AnswerEntry): number | null {
  if (entry.digits === '') return null;
  const value = Number(entry.digits);
  return entry.negative && value !== 0 ? -value : value;
}

/** As shown in the answer field: a real minus sign, "−" alone while only the sign is set. */
export function formatEntry(entry: AnswerEntry): string {
  return `${entry.negative ? '−' : ''}${entry.digits}`;
}
