import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyBattleAction,
  createBattle,
  type BattleEvent,
  type BattleState,
  type Seat,
} from './battle.js';
import { generateQuestion } from './generator.js';

/** A player's move: how long after the previous action, and whether the answer is right. */
const move = fc.record({
  seat: fc.constantFrom<Seat>(0, 1),
  delay: fc.nat({ max: 6_000 }),
  kind: fc.constantFrom('right', 'wrong', 'stale', 'tick'),
});

const battle = fc.record({
  seed: fc.nat({ max: 0xffff_ffff }),
  arena: fc.constantFrom(1, 2, 3, 4, 5),
  moves: fc.array(move, { maxLength: 80 }),
});

type Input = typeof battle extends fc.Arbitrary<infer T> ? T : never;

function play({ seed, arena, moves }: Input) {
  const level = { arena, trophies: 0 } as const;
  let state: BattleState = createBattle({ seed, level });
  const states = [state];
  const events: BattleEvent[] = [];
  let at = 0;
  for (const { seat, delay, kind } of moves) {
    at += delay;
    const player = state.players[seat];
    const answer = generateQuestion(seed, player.questionIndex, level).answer;
    const update =
      kind === 'tick'
        ? applyBattleAction(state, { type: 'tick', at })
        : applyBattleAction(state, {
            type: 'answer',
            seat,
            questionIndex: kind === 'stale' ? player.questionIndex + 1 : player.questionIndex,
            value: kind === 'wrong' ? answer + 1 : answer,
            at,
          });
    state = update.state;
    states.push(state);
    events.push(...update.events);
  }
  return { state, states, events };
}

describe('battle engine properties', () => {
  it('HP stays within 0–100 and matches the damage dealt', () => {
    fc.assert(
      fc.property(battle, (input) => {
        const { state, events } = play(input);
        for (const seat of [0, 1] as const) {
          const hp = state.players[seat].hp;
          expect(hp).toBeGreaterThanOrEqual(0);
          expect(hp).toBeLessThanOrEqual(100);
          const dealt = events
            .filter((e) => e.type === 'hit' && e.seat !== seat)
            .reduce((sum, e) => sum + (e.type === 'hit' ? e.damage : 0), 0);
          expect(hp).toBe(Math.max(0, 100 - dealt));
        }
      }),
      { numRuns: 2_000 },
    );
  });

  it('ends at most once, and nothing changes after the end', () => {
    fc.assert(
      fc.property(battle, (input) => {
        const { states, events } = play(input);
        expect(events.filter((e) => e.type === 'end').length).toBeLessThanOrEqual(1);
        const endIndex = states.findIndex((s) => s.result !== null);
        if (endIndex >= 0) {
          for (const later of states.slice(endIndex)) {
            expect(later).toBe(states[endIndex]);
          }
        }
      }),
      { numRuns: 2_000 },
    );
  });

  it('a KO means the loser is at 0 HP; a time-out result follows the HP', () => {
    fc.assert(
      fc.property(battle, (input) => {
        const { state } = play(input);
        const result = state.result;
        if (result === null) return;
        const [a, b] = state.players;
        if (result.reason === 'ko' && result.outcome === 'win') {
          expect(state.players[result.winner === 0 ? 1 : 0].hp).toBe(0);
        } else if (result.outcome === 'draw') {
          expect(a.hp).toBe(b.hp);
        } else {
          expect(state.players[result.winner].hp).toBeGreaterThan(
            state.players[result.winner === 0 ? 1 : 0].hp,
          );
        }
      }),
      { numRuns: 2_000 },
    );
  });

  it('is deterministic: the same actions give the same battle', () => {
    fc.assert(
      fc.property(battle, (input) => {
        expect(play(input).state).toEqual(play(input).state);
      }),
      { numRuns: 500 },
    );
  });
});
