import {
  applyBattleAction,
  createBattle,
  generateQuestion,
  type BattleAction,
  type BattleEvent,
  type BattleState,
} from '@mathgo/game-core';
import { battleEffects } from './effects';

const level = { arena: 3, trophies: 842 } as const;
const right = (s: BattleState, seat: 0 | 1, at: number): BattleAction => ({
  type: 'answer',
  seat,
  questionIndex: s.players[seat].questionIndex,
  value: generateQuestion(s.seed, s.players[seat].questionIndex, s.level).answer,
  at,
});

function run(steps: ((s: BattleState) => BattleAction)[]): BattleEvent[] {
  let state = createBattle({ seed: 3, level });
  const events: BattleEvent[] = [];
  for (const step of steps) {
    const update = applyBattleAction(state, step(state));
    state = update.state;
    events.push(...update.events);
  }
  return events;
}

describe('battle effects (S2-09)', () => {
  it('a fast hit by me: damage 15 with FAST +5', () => {
    const effects = battleEffects(run([(s) => right(s, 0, 1_000)]), 0);
    expect(effects).toEqual([{ kind: 'hit', by: 'me', damage: 15, fast: true, combo: false }]);
  });

  it('the same hit seen by the rival', () => {
    expect(battleEffects(run([(s) => right(s, 0, 5_000)]), 1)).toEqual([
      { kind: 'hit', by: 'rival', damage: 10, fast: false, combo: false },
    ]);
  });

  it('three in a row: combo ready, then a double hit', () => {
    const effects = battleEffects(
      run([
        (s) => right(s, 0, 5_000),
        (s) => right(s, 0, 10_000),
        (s) => right(s, 0, 15_000),
        (s) => right(s, 0, 20_000),
      ]),
      0,
    );
    expect(effects.map((e) => e.kind)).toEqual(['hit', 'hit', 'hit', 'combo-ready', 'hit']);
    expect(effects[4]).toMatchObject({ damage: 20, combo: true });
  });

  it('a wrong answer is a miss', () => {
    const events = run([
      () => ({ type: 'answer', seat: 1, questionIndex: 0, value: -1, at: 2_000 }),
    ]);
    expect(battleEffects(events, 0)).toEqual([{ kind: 'miss', side: 'rival' }]);
  });

  it('a knockout: win for one seat, loss for the other', () => {
    const steps = Array.from(
      { length: 10 },
      (_, i) => (s: BattleState) => right(s, 0, 1_000 + i * 500),
    );
    const events = run(steps);
    expect(battleEffects(events, 0).at(-1)).toEqual({ kind: 'end', outcome: 'win', reason: 'ko' });
    expect(battleEffects(events, 1).at(-1)).toEqual({ kind: 'end', outcome: 'lose', reason: 'ko' });
  });

  it('time out with equal HP is a draw', () => {
    expect(battleEffects(run([() => ({ type: 'tick', at: 90_000 })]), 0)).toEqual([
      { kind: 'end', outcome: 'draw', reason: 'time' },
    ]);
  });
});
