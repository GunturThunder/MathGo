import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BATTLE_RULES,
  applyBattleAction,
  createBattle,
  type BattleState,
  type BattleUpdate,
  type Seat,
} from './battle.js';
import { generateQuestion } from './generator.js';

const SEED = 20_261_005;
const LEVEL = { arena: 2, trophies: 400 } as const;
const SLOW = 5_000; // Past the 3 s speed-bonus window.

const newBattle = () => createBattle({ seed: SEED, level: LEVEL });

const answerOf = (state: BattleState, seat: Seat) =>
  generateQuestion(state.seed, state.players[seat].questionIndex, state.level).answer;

const right = (state: BattleState, seat: Seat, at: number): BattleUpdate =>
  applyBattleAction(state, {
    type: 'answer',
    seat,
    questionIndex: state.players[seat].questionIndex,
    value: answerOf(state, seat),
    at,
  });

const wrong = (state: BattleState, seat: Seat, at: number): BattleUpdate =>
  applyBattleAction(state, {
    type: 'answer',
    seat,
    questionIndex: state.players[seat].questionIndex,
    value: answerOf(state, seat) + 1,
    at,
  });

/** Seat 0 answers correctly `count` times, each `gap` ms after its question showed. */
function rightInARow(state: BattleState, count: number, gap: number, seat: Seat = 0) {
  const damages: number[] = [];
  for (let i = 0; i < count; i++) {
    const shown = state.players[seat].questionShownAt;
    const update = right(state, seat, Math.max(state.now, shown + gap));
    const hit = update.events.find((e) => e.type === 'hit');
    damages.push(hit?.type === 'hit' ? hit.damage : 0);
    state = update.state;
  }
  return { state, damages };
}

describe('createBattle', () => {
  it('starts both players on question 0 with 100 HP', () => {
    const state = newBattle();
    expect(state.rules).toEqual(DEFAULT_BATTLE_RULES);
    expect(state.players.map((p) => [p.hp, p.questionIndex])).toEqual([
      [100, 0],
      [100, 0],
    ]);
    expect(state.result).toBeNull();
  });

  it('rejects impossible rules', () => {
    const bad = (patch: object) => () =>
      createBattle({ seed: 1, level: LEVEL, rules: { ...DEFAULT_BATTLE_RULES, ...patch } });
    expect(bad({ hp: 0 })).toThrow(RangeError);
    expect(bad({ damage: -1 })).toThrow(RangeError);
    expect(bad({ durationMs: 1.5 })).toThrow(RangeError);
  });
});

describe('damage', () => {
  it('a correct answer deals 10 damage and moves to the next question', () => {
    const { state, events } = right(newBattle(), 0, SLOW);
    expect(events).toEqual([
      {
        type: 'hit',
        seat: 0,
        questionIndex: 0,
        damage: 10,
        speedBonus: false,
        combo: false,
        targetHp: 90,
      },
    ]);
    expect(state.players[1].hp).toBe(90);
    expect(state.players[0]).toMatchObject({ questionIndex: 1, questionShownAt: SLOW, correct: 1 });
  });

  it('adds the +5 speed bonus under 3 s, not at 3 s', () => {
    expect(right(newBattle(), 0, 2_999).state.players[1].hp).toBe(85);
    expect(right(newBattle(), 0, 3_000).state.players[1].hp).toBe(90);
  });

  it('times the speed bonus from when the current question showed', () => {
    const first = right(newBattle(), 0, 10_000).state; // slow
    const second = right(first, 0, 12_500); // 2.5 s after question 1 showed
    expect(second.events[0]).toMatchObject({ type: 'hit', speedBonus: true, damage: 15 });
  });

  it('players race through the same questions independently', () => {
    let state = right(newBattle(), 0, 1_000).state;
    state = right(state, 0, 2_000).state;
    expect(state.players[0].questionIndex).toBe(2);
    expect(state.players[1].questionIndex).toBe(0);
    const update = right(state, 1, 2_500);
    expect(update.events[0]).toMatchObject({ type: 'hit', seat: 1, questionIndex: 0 });
  });
});

describe('combo', () => {
  it('3 correct in a row make the next hit deal double damage', () => {
    const { state, damages } = rightInARow(newBattle(), 4, SLOW);
    expect(damages).toEqual([10, 10, 10, 20]);
    expect(state.players[1].hp).toBe(50);
  });

  it('doubles the speed bonus too', () => {
    expect(rightInARow(newBattle(), 4, 1_000).damages).toEqual([15, 15, 15, 30]);
  });

  it('announces the charged combo on the third correct answer', () => {
    const { state } = rightInARow(newBattle(), 2, SLOW);
    const update = right(state, 0, state.now + SLOW);
    expect(update.events.map((e) => e.type)).toEqual(['hit', 'combo-ready']);
  });

  it('a combo hit spends the charge, so the next one comes 4 hits later', () => {
    // 4 × 10-damage cycles would KO at 100, so use more HP to see the pattern.
    const rules = { ...DEFAULT_BATTLE_RULES, hp: 1_000 };
    const start = createBattle({ seed: SEED, level: LEVEL, rules });
    expect(rightInARow(start, 9, SLOW).damages).toEqual([10, 10, 10, 20, 10, 10, 10, 20, 10]);
  });

  it('a wrong answer resets the streak and drops a charged combo', () => {
    let { state } = rightInARow(newBattle(), 3, SLOW); // combo charged
    expect(state.players[0].comboReady).toBe(true);
    state = wrong(state, 0, state.now + SLOW).state;
    expect(state.players[0]).toMatchObject({ streak: 0, comboReady: false });
    const after = rightInARow(state, 4, SLOW);
    expect(after.damages).toEqual([10, 10, 10, 20]);
  });
});

describe('wrong answers', () => {
  it('lock input for 1 s, then show the next question', () => {
    const { state, events } = wrong(newBattle(), 0, 4_000);
    expect(events).toEqual([{ type: 'miss', seat: 0, questionIndex: 0, lockedUntil: 5_000 }]);
    expect(state.players[0]).toMatchObject({
      questionIndex: 1,
      questionShownAt: 5_000,
      lockedUntil: 5_000,
      wrong: 1,
    });
    expect(state.players[1].hp).toBe(100);
  });

  it('reject answers during the lock and accept them when it ends', () => {
    const locked = wrong(newBattle(), 0, 4_000).state;
    const early = right(locked, 0, 4_999);
    expect(early.events).toEqual([{ type: 'rejected', seat: 0, reason: 'locked' }]);
    expect(early.state.players).toEqual(locked.players);
    // Answered at the end of the lock: 0 s after the question showed, so the bonus applies.
    expect(right(locked, 0, 5_000).events[0]).toMatchObject({ type: 'hit', damage: 15 });
  });

  it('do not lock the other player', () => {
    const locked = wrong(newBattle(), 0, 4_000).state;
    expect(right(locked, 1, 4_500).events[0]).toMatchObject({ type: 'hit', seat: 1 });
  });
});

describe('answers', () => {
  it('for a question other than the current one are rejected', () => {
    const state = right(newBattle(), 0, 1_000).state;
    const update = applyBattleAction(state, {
      type: 'answer',
      seat: 0,
      questionIndex: 0,
      value: generateQuestion(SEED, 0, LEVEL).answer,
      at: 2_000,
    });
    expect(update.events).toEqual([{ type: 'rejected', seat: 0, reason: 'stale-question' }]);
    expect(update.state.players).toEqual(state.players);
  });

  it('never go back in time', () => {
    const state = right(newBattle(), 0, 5_000).state;
    expect(() => right(state, 1, 4_999)).toThrow(RangeError);
    expect(() => applyBattleAction(state, { type: 'tick', at: 1.5 })).toThrow(RangeError);
  });

  it('leave the previous state unchanged', () => {
    const state = newBattle();
    const before: unknown = JSON.parse(JSON.stringify(state));
    right(state, 0, 1_000);
    wrong(state, 1, 1_000);
    expect(state).toEqual(before);
  });
});

describe('knockout', () => {
  it('ends the battle when HP reaches 0, and HP never goes below 0', () => {
    // Fast hits: 15, 15, 15, 30 (combo), 15, 15 → 105 ≥ 100.
    const { state, damages } = rightInARow(newBattle(), 6, 1_000);
    expect(damages).toEqual([15, 15, 15, 30, 15, 15]);
    expect(state.players[1].hp).toBe(0);
    expect(state.result).toEqual({ outcome: 'win', winner: 0, reason: 'ko' });
  });

  it('emits the final hit and the end', () => {
    const { state } = rightInARow(newBattle(), 5, 1_000);
    const update = right(state, 0, state.now + 1_000);
    expect(update.events.map((e) => e.type)).toEqual(['hit', 'end']);
  });

  it('rejects answers after the battle ends', () => {
    const { state } = rightInARow(newBattle(), 6, 1_000);
    const update = right(state, 1, state.now + 100);
    expect(update.events).toEqual([{ type: 'rejected', seat: 1, reason: 'finished' }]);
    expect(update.state).toBe(state);
  });
});

describe('timer', () => {
  it('lasts 90 s: an answer just before the buzzer counts', () => {
    const update = right(newBattle(), 0, 89_999);
    expect(update.state.result).toBeNull();
    expect(update.state.players[1].hp).toBe(90);
  });

  it('at 90 s, higher HP wins', () => {
    const state = right(newBattle(), 1, SLOW).state;
    const update = applyBattleAction(state, { type: 'tick', at: 90_000 });
    expect(update.state.result).toEqual({ outcome: 'win', winner: 1, reason: 'time' });
    expect(update.events).toEqual([{ type: 'end', result: update.state.result }]);
    expect(update.state.now).toBe(90_000);
  });

  it('at 90 s, equal HP is a draw', () => {
    let state = right(newBattle(), 0, SLOW).state;
    state = right(state, 1, SLOW + 1).state;
    const update = applyBattleAction(state, { type: 'tick', at: 95_000 });
    expect(update.state.result).toEqual({ outcome: 'draw', reason: 'time' });
  });

  it('an answer at or after 90 s is too late and ends the battle', () => {
    const update = right(newBattle(), 0, 90_000);
    expect(update.events).toEqual([
      { type: 'rejected', seat: 0, reason: 'finished' },
      { type: 'end', result: { outcome: 'draw', reason: 'time' } },
    ]);
    expect(update.state.players[1].hp).toBe(100);
  });

  it('a tick before 90 s only moves the clock', () => {
    const update = applyBattleAction(newBattle(), { type: 'tick', at: 30_000 });
    expect(update.events).toEqual([]);
    expect(update.state.now).toBe(30_000);
    expect(update.state.result).toBeNull();
  });
});

describe('stats for the result screen', () => {
  it('count correct and wrong answers and the best run (combo hits keep the run going)', () => {
    let { state } = rightInARow(newBattle(), 5, SLOW); // run of 5, including a combo hit
    state = wrong(state, 0, state.now + SLOW).state;
    state = rightInARow(state, 2, SLOW).state;
    expect(state.players[0]).toMatchObject({ correct: 7, wrong: 1, run: 2, bestStreak: 5 });
  });
});

describe('forfeit (FR-07)', () => {
  it('the other player wins at once', () => {
    const state = right(newBattle(), 0, SLOW).state;
    const update = applyBattleAction(state, { type: 'forfeit', seat: 0, at: 20_000 });
    const result = { outcome: 'win', winner: 1, reason: 'forfeit' };
    expect(update.state.result).toEqual(result);
    expect(update.events).toEqual([{ type: 'end', result }]);
    expect(update.state.now).toBe(20_000);
    // HP is left as it was: the leader can still lose by forfeiting.
    expect(update.state.players[1].hp).toBe(90);
  });

  it('changes nothing after the battle has ended', () => {
    const ended = applyBattleAction(newBattle(), { type: 'tick', at: 90_000 }).state;
    const update = applyBattleAction(ended, { type: 'forfeit', seat: 1, at: 95_000 });
    expect(update.state).toBe(ended);
    expect(update.events).toEqual([]);
  });

  it('at or after 90 s the timer decides, not the forfeit', () => {
    const update = applyBattleAction(newBattle(), { type: 'forfeit', seat: 0, at: 90_000 });
    expect(update.state.result).toEqual({ outcome: 'draw', reason: 'time' });
  });
});
