import type { BattleEvent, BattleResult, Seat } from '@mathgo/game-core';

// What the battle screen animates (S2-09), from game-core's battle events. Seen from one seat:
// "me" is the player holding this phone.

export type Side = 'me' | 'rival';
export type Outcome = 'win' | 'lose' | 'draw';

export type BattleEffect =
  /** `by` hit the other side for `damage`. */
  | {
      readonly kind: 'hit';
      readonly by: Side;
      readonly damage: number;
      readonly fast: boolean;
      readonly combo: boolean;
    }
  | { readonly kind: 'combo-ready'; readonly side: Side }
  /** A wrong answer: shake, then the 1 s lock. */
  | { readonly kind: 'miss'; readonly side: Side }
  | { readonly kind: 'end'; readonly outcome: Outcome; readonly reason: BattleResult['reason'] };

/** Each effect gets an id, so the same effect twice in a row still plays twice. */
export type QueuedEffect = BattleEffect & { readonly id: number };

export function outcomeFor(result: BattleResult, seat: Seat): Outcome {
  if (result.outcome === 'draw') return 'draw';
  return result.winner === seat ? 'win' : 'lose';
}

export function battleEffects(events: readonly BattleEvent[], seat: Seat): BattleEffect[] {
  const side = (s: Seat): Side => (s === seat ? 'me' : 'rival');
  return events.flatMap((e): BattleEffect[] => {
    switch (e.type) {
      case 'hit':
        return [
          { kind: 'hit', by: side(e.seat), damage: e.damage, fast: e.speedBonus, combo: e.combo },
        ];
      case 'combo-ready':
        return [{ kind: 'combo-ready', side: side(e.seat) }];
      case 'miss':
        return [{ kind: 'miss', side: side(e.seat) }];
      case 'end':
        return [{ kind: 'end', outcome: outcomeFor(e.result, seat), reason: e.result.reason }];
      case 'rejected':
        return [];
    }
  });
}
