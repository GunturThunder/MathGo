import {
  applyBattleAction,
  createBattle,
  generateQuestion,
  type BattleAction,
  type BattleState,
} from '@mathgo/game-core';
import { battleView, formatClock } from './battle-view';

const fighters = {
  me: { name: 'SwiftComet27', trophies: 842 },
  rival: { name: 'ZippyPrism08', trophies: 865 },
};
const level = { arena: 3, trophies: 842 } as const;

function play(actions: (s: BattleState) => BattleAction[]): BattleState {
  let state = createBattle({ seed: 42, level });
  for (const action of actions(state)) state = applyBattleAction(state, action).state;
  return state;
}
const right = (s: BattleState, seat: 0 | 1, q: number, at: number): BattleAction => ({
  type: 'answer',
  seat,
  questionIndex: q,
  value: generateQuestion(s.seed, q, s.level).answer,
  at,
});

describe('battle view (S2-08)', () => {
  it('a fresh battle', () => {
    const view = battleView(createBattle({ seed: 42, level }), 0, fighters, 0);
    expect(view).toMatchObject({
      arena: 3,
      arenaName: 'Times Tower',
      timerText: '1:30',
      timeShare: 1,
      timerWarning: false,
      questionNumber: 1,
      comboLit: 0,
      comboReady: false,
      locked: false,
    });
    expect(view.me).toEqual({ name: 'SwiftComet27', trophies: 842, hp: 100, hpShare: 1 });
  });

  it('clock: rounds up, warns in the last 10 s, stops at 0:00', () => {
    expect(formatClock(67_001)).toBe('1:08');
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(-5)).toBe('0:00');
    const state = createBattle({ seed: 42, level });
    expect(battleView(state, 0, fighters, 80_000)).toMatchObject({
      timerText: '0:10',
      timerWarning: true,
    });
    expect(battleView(state, 0, fighters, 95_000)).toMatchObject({
      timerText: '0:00',
      timeShare: 0,
    });
  });

  it('my hits lower the rival HP; combo lights flames, then is ready', () => {
    // Slow answers (no speed bonus): 10 damage each.
    const state = play((s) => [right(s, 0, 0, 4_000), right(s, 0, 1, 8_000)]);
    const view = battleView(state, 0, fighters, 8_000);
    expect(view.rival.hp).toBe(80);
    expect(view.rival.hpShare).toBeCloseTo(0.8);
    expect(view).toMatchObject({ questionNumber: 3, comboLit: 2, comboReady: false });
    const ready = play((s) => [
      right(s, 0, 0, 4_000),
      right(s, 0, 1, 8_000),
      right(s, 0, 2, 12_000),
    ]);
    expect(battleView(ready, 0, fighters, 12_000)).toMatchObject({ comboLit: 3, comboReady: true });
  });

  it('seen from either seat', () => {
    const state = play((s) => [right(s, 1, 0, 4_000)]);
    expect(battleView(state, 1, fighters, 4_000).rival.hp).toBe(90);
    expect(battleView(state, 0, fighters, 4_000).me.hp).toBe(90);
  });

  it('locked for 1 s after a wrong answer', () => {
    const state = play(() => [{ type: 'answer', seat: 0, questionIndex: 0, value: -1, at: 5_000 }]);
    expect(battleView(state, 0, fighters, 5_500).locked).toBe(true);
    expect(battleView(state, 0, fighters, 6_000).locked).toBe(false);
  });
});
