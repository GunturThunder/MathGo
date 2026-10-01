import {
  EMPTY_ENTRY,
  allowsNegative,
  entryValue,
  formatEntry,
  maxDigits,
  pressKey,
  type AnswerEntry,
  type KeypadKey,
} from './answer-entry';
import type { ArenaId } from '@mathgo/game-core';

const type = (keys: KeypadKey[], arena: ArenaId = 3): AnswerEntry =>
  keys.reduce((entry, key) => pressKey(entry, key, arena), EMPTY_ENTRY);

describe('answer entry (S2-07)', () => {
  it('room for the longest answer in each arena', () => {
    expect([1, 2, 3, 4, 5].map((a) => maxDigits(a as ArenaId))).toEqual([2, 3, 3, 3, 4]);
  });

  it('types a 3-digit answer', () => {
    const entry = type(['1', '4', '4']);
    expect(entryValue(entry)).toBe(144);
    expect(formatEntry(entry)).toBe('144');
  });

  it('stops at the arena limit', () => {
    expect(entryValue(type(['1', '2', '3'], 1))).toBe(12);
    expect(entryValue(type(['9', '9', '9', '9'], 4))).toBe(999);
    expect(entryValue(type(['9', '9', '9', '9', '9'], 5))).toBe(9999);
  });

  it('no leading zeros, but 0 is an answer', () => {
    expect(formatEntry(type(['0', '0', '7']))).toBe('7');
    expect(entryValue(type(['0']))).toBe(0);
  });

  it('delete removes the last digit, then the sign', () => {
    expect(formatEntry(type(['4', '2', 'delete']))).toBe('4');
    expect(type(['sign', '5', 'delete', 'delete'], 5)).toEqual(EMPTY_ENTRY);
    expect(type(['delete'])).toEqual(EMPTY_ENTRY);
  });

  it('negatives only in Power Peak', () => {
    expect([1, 2, 3, 4, 5].map((a) => allowsNegative(a as ArenaId))).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(entryValue(type(['sign', '1', '7'], 5))).toBe(-17);
    expect(formatEntry(type(['1', '7', 'sign'], 5))).toBe('−17');
    expect(entryValue(type(['sign', '1', '7'], 4))).toBe(17);
  });

  it('nothing to send until a digit is typed', () => {
    expect(entryValue(EMPTY_ENTRY)).toBeNull();
    expect(entryValue(type(['sign'], 5))).toBeNull();
    expect(formatEntry(type(['sign'], 5))).toBe('−');
    expect(entryValue(type(['sign', '0'], 5))).toBe(0);
  });
});
