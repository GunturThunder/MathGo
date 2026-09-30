import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ARENAS } from './arenas.js';
import { gapAdjustment, settleTrophies, trophyChange } from './trophies.js';

const change = (trophies: number, opponentTrophies: number, outcome: 'win' | 'loss' | 'draw') =>
  trophyChange({ trophies, opponentTrophies, outcome });

describe('trophyChange', () => {
  it('a win against an equal opponent earns +30', () => {
    expect(change(500, 500, 'win')).toEqual({
      delta: 30,
      trophies: 530,
      arenaBefore: 2,
      arenaAfter: 2,
      floored: false,
    });
  });

  it('a loss against an equal opponent costs 20', () => {
    expect(change(500, 500, 'loss')).toMatchObject({ delta: -20, trophies: 480, floored: false });
  });

  it('a draw changes nothing, whatever the gap', () => {
    expect(change(500, 900, 'draw')).toMatchObject({ delta: 0, trophies: 500 });
    expect(change(900, 500, 'draw')).toMatchObject({ delta: 0, trophies: 900 });
  });

  it('a stronger opponent: a win earns more and a loss costs less, up to 10', () => {
    expect(change(500, 600, 'win').delta).toBe(35); // gap 100 → +5
    expect(change(500, 700, 'win').delta).toBe(40); // gap 200 → +10
    expect(change(500, 1_500, 'win').delta).toBe(40); // capped
    expect(change(500, 600, 'loss').delta).toBe(-15);
    expect(change(500, 1_500, 'loss').delta).toBe(-10);
  });

  it('a weaker opponent: a win earns less and a loss costs more, up to 10', () => {
    expect(change(900, 800, 'win').delta).toBe(25);
    expect(change(900, 100, 'win').delta).toBe(20);
    expect(change(900, 800, 'loss').delta).toBe(-25);
    expect(change(900, 100, 'loss').delta).toBe(-30);
  });

  it('a loss at an arena floor keeps the player at the start of the arena', () => {
    expect(change(300, 300, 'loss')).toEqual({
      delta: 0,
      trophies: 300,
      arenaBefore: 2,
      arenaAfter: 2,
      floored: true,
    });
  });

  it('a loss just above an arena floor stops at the floor', () => {
    expect(change(710, 710, 'loss')).toMatchObject({ delta: -10, trophies: 700, floored: true });
  });

  it('Counting Camp never goes below 0', () => {
    expect(change(5, 5, 'loss')).toMatchObject({ delta: -5, trophies: 0, floored: true });
  });

  it('crossing into the next arena reports the unlock', () => {
    expect(change(290, 290, 'win')).toMatchObject({ trophies: 320, arenaBefore: 1, arenaAfter: 2 });
  });

  it('rejects impossible trophy counts', () => {
    expect(() => change(-1, 0, 'win')).toThrow(RangeError);
    expect(() => change(0, 1.5, 'win')).toThrow(RangeError);
  });
});

describe('gapAdjustment', () => {
  it('ignores gaps under 20 and counts one point per full 20', () => {
    expect(gapAdjustment(500, 519)).toBe(0);
    expect(gapAdjustment(500, 481)).toBe(0);
    expect(gapAdjustment(500, 520)).toBe(1);
    expect(gapAdjustment(500, 459)).toBe(-2);
  });
});

describe('settleTrophies', () => {
  it('gives each seat its own change', () => {
    const [a, b] = settleTrophies({ outcome: 'win', winner: 1, reason: 'ko' }, [800, 600]);
    expect(a).toMatchObject({ delta: -30, trophies: 770 }); // lost to a weaker player
    expect(b).toMatchObject({ delta: 40, trophies: 640 }); // beat a stronger player
  });

  it('a draw changes nothing for either seat', () => {
    const changes = settleTrophies({ outcome: 'draw', reason: 'time' }, [800, 600]);
    expect(changes.map((c) => c.delta)).toEqual([0, 0]);
  });
});

describe('trophy properties', () => {
  const trophies = fc.nat({ max: 5_000 });

  it('a win always gains 20–40, and trophies never drop below the arena start', () => {
    fc.assert(
      fc.property(trophies, trophies, fc.constantFrom('win', 'loss', 'draw'), (t, o, outcome) => {
        const result = change(t, o, outcome);
        const floor = ARENAS.find((a) => a.id === result.arenaBefore)?.minTrophies ?? 0;
        expect(result.trophies).toBeGreaterThanOrEqual(floor);
        expect(result.trophies).toBe(t + result.delta);
        if (outcome === 'win') {
          expect(result.delta).toBeGreaterThanOrEqual(20);
          expect(result.delta).toBeLessThanOrEqual(40);
        } else if (outcome === 'loss') {
          expect(result.delta).toBeLessThanOrEqual(0);
          expect(result.delta).toBeGreaterThanOrEqual(-30);
          expect(result.arenaAfter).toBe(result.arenaBefore);
        }
      }),
      { numRuns: 5_000 },
    );
  });
});
