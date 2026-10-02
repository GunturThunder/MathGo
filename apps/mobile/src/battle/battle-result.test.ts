import {
  applyBattleAction,
  createBattle,
  generateQuestion,
  type BattleState,
} from '@mathgo/game-core';
import { battleSummary } from './battle-result';

const fighters = {
  me: { name: 'Kamu', trophies: null },
  rival: { name: 'Bot · Sedang', trophies: null },
};
const fresh = () => createBattle({ seed: 5, level: { arena: 1, trophies: 150 } });
const right = (s: BattleState, seat: 0 | 1, at: number) =>
  applyBattleAction(s, {
    type: 'answer',
    seat,
    questionIndex: s.players[seat].questionIndex,
    value: generateQuestion(s.seed, s.players[seat].questionIndex, s.level).answer,
    at,
  }).state;

describe('battle summary (S2-11)', () => {
  it('nothing while the battle runs', () => {
    expect(battleSummary(fresh(), 0, fighters)).toBeNull();
  });

  it('a knockout: who won, time left, answers, best combo, damage both ways', () => {
    let s = fresh();
    s = right(s, 1, 4_000); // the bot lands one slow hit: 10
    s = applyBattleAction(s, {
      type: 'answer',
      seat: 0,
      questionIndex: 0,
      value: -1,
      at: 5_000,
    }).state;
    // Then slow right answers until the bot is out: 10 each, combos double every 4th.
    for (let at = 10_000; s.result === null; at += 4_000) s = right(s, 0, at);
    const summary = battleSummary(s, 0, fighters);
    expect(summary).toMatchObject({
      outcome: 'win',
      reason: 'ko',
      answered: summary!.correct + 1,
      me: { name: 'Kamu', damage: 100 },
      rival: { name: 'Bot · Sedang', damage: 10 },
    });
    expect(summary!.bestCombo).toBe(summary!.correct);
    expect(summary!.secondsLeft).toBe(Math.floor((90_000 - s.now) / 1000));
    expect(battleSummary(s, 1, fighters)).toMatchObject({ outcome: 'lose', reason: 'ko' });
  });

  it('time-out: 0 s left; a draw when HP is equal', () => {
    const s = applyBattleAction(fresh(), { type: 'tick', at: 90_000 }).state;
    expect(battleSummary(s, 0, fighters)).toMatchObject({
      outcome: 'draw',
      reason: 'time',
      secondsLeft: 0,
      answered: 0,
      bestCombo: 0,
      me: { damage: 0 },
    });
  });
});
