import type { QuestionLevel } from './difficulty.js';
import { generateQuestion } from './generator.js';

/** Starting values from the PRD's battle-rules table; tuned at the fun gate (S2-15). */
export interface BattleRules {
  readonly hp: number;
  readonly damage: number;
  /** Extra damage for an answer given within `speedBonusWindowMs` of the question showing. */
  readonly speedBonus: number;
  readonly speedBonusWindowMs: number;
  /** Correct answers in a row that charge a combo. */
  readonly comboStreak: number;
  /** The charged hit's damage (speed bonus included) is multiplied by this. */
  readonly comboMultiplier: number;
  readonly wrongAnswerLockMs: number;
  readonly durationMs: number;
}

export const DEFAULT_BATTLE_RULES: BattleRules = {
  hp: 100,
  damage: 10,
  speedBonus: 5,
  speedBonusWindowMs: 3000,
  comboStreak: 3,
  comboMultiplier: 2,
  wrongAnswerLockMs: 1000,
  durationMs: 90_000,
};

/** Seat 0 or 1. */
export type Seat = 0 | 1;

export interface PlayerState {
  readonly hp: number;
  /** The question this player is on; both players get the same sequence (race mode). */
  readonly questionIndex: number;
  /** When the current question showed, in ms from the battle start. */
  readonly questionShownAt: number;
  /** Correct answers in a row since the last wrong answer or combo hit. */
  readonly streak: number;
  /** The next correct answer deals combo damage. */
  readonly comboReady: boolean;
  /** Correct answers in a row since the last wrong answer; combo hits don't break it. */
  readonly run: number;
  /** No answers accepted before this time (wrong-answer lock). */
  readonly lockedUntil: number;
  readonly correct: number;
  readonly wrong: number;
  /** Longest `run`, shown as the best combo on the result screen. */
  readonly bestStreak: number;
}

export type BattleResult =
  | { readonly outcome: 'win'; readonly winner: Seat; readonly reason: 'ko' | 'time' }
  | { readonly outcome: 'draw'; readonly reason: 'time' };

export interface BattleState {
  readonly seed: number;
  readonly level: QuestionLevel;
  readonly rules: BattleRules;
  /** Latest time seen, in ms from the battle start. */
  readonly now: number;
  readonly players: readonly [PlayerState, PlayerState];
  /** Null while the battle runs. */
  readonly result: BattleResult | null;
}

export type BattleAction =
  /** A typed answer to question `questionIndex`, received at `at` (server clock). */
  | {
      readonly type: 'answer';
      readonly seat: Seat;
      readonly questionIndex: number;
      readonly value: number;
      readonly at: number;
    }
  /** Advances the clock, so the battle ends on time without an answer. */
  | { readonly type: 'tick'; readonly at: number };

export type RejectReason = 'finished' | 'locked' | 'stale-question';

export type BattleEvent =
  | {
      readonly type: 'hit';
      readonly seat: Seat;
      readonly questionIndex: number;
      readonly damage: number;
      readonly speedBonus: boolean;
      readonly combo: boolean;
      /** The target's HP after the hit. */
      readonly targetHp: number;
    }
  | { readonly type: 'combo-ready'; readonly seat: Seat }
  | {
      readonly type: 'miss';
      readonly seat: Seat;
      readonly questionIndex: number;
      readonly lockedUntil: number;
    }
  | { readonly type: 'rejected'; readonly seat: Seat; readonly reason: RejectReason }
  | { readonly type: 'end'; readonly result: BattleResult };

export interface BattleUpdate {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

export interface NewBattle {
  readonly seed: number;
  readonly level: QuestionLevel;
  readonly rules?: BattleRules;
}

function newPlayer(rules: BattleRules): PlayerState {
  return {
    hp: rules.hp,
    questionIndex: 0,
    questionShownAt: 0,
    streak: 0,
    comboReady: false,
    run: 0,
    lockedUntil: 0,
    correct: 0,
    wrong: 0,
    bestStreak: 0,
  };
}

function assertRules(rules: BattleRules): void {
  for (const [name, value] of Object.entries(rules)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`Battle rule ${name} must be a non-negative integer, got ${value}`);
    }
  }
  if (rules.hp === 0 || rules.durationMs === 0 || rules.comboStreak === 0) {
    throw new RangeError('hp, durationMs and comboStreak must be above 0');
  }
}

/** A battle at time 0: both players on question 0 with full HP. */
export function createBattle({
  seed,
  level,
  rules = DEFAULT_BATTLE_RULES,
}: NewBattle): BattleState {
  assertRules(rules);
  return {
    seed,
    level,
    rules,
    now: 0,
    players: [newPlayer(rules), newPlayer(rules)],
    result: null,
  };
}

const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

function withPlayer(
  players: BattleState['players'],
  seat: Seat,
  player: PlayerState,
): BattleState['players'] {
  return seat === 0 ? [player, players[1]] : [players[0], player];
}

function timeUpResult(players: BattleState['players']): BattleResult {
  const [a, b] = players;
  if (a.hp === b.hp) {
    return { outcome: 'draw', reason: 'time' };
  }
  return { outcome: 'win', winner: a.hp > b.hp ? 0 : 1, reason: 'time' };
}

/**
 * Applies one action. Pure: returns a new state and the events it caused, and never changes
 * `state`. Times are ms from the battle start and must not go backwards.
 */
export function applyBattleAction(state: BattleState, action: BattleAction): BattleUpdate {
  if (!Number.isSafeInteger(action.at) || action.at < state.now) {
    throw new RangeError(`Action time ${action.at} is before the battle clock ${state.now}`);
  }
  if (state.result !== null) {
    return {
      state,
      events:
        action.type === 'answer'
          ? [{ type: 'rejected', seat: action.seat, reason: 'finished' }]
          : [],
    };
  }

  // The timer ends the battle before anything at or after the buzzer counts.
  if (action.at >= state.rules.durationMs) {
    const result = timeUpResult(state.players);
    const ended: BattleState = { ...state, now: state.rules.durationMs, result };
    const events: BattleEvent[] = [{ type: 'end', result }];
    if (action.type === 'answer') {
      events.unshift({ type: 'rejected', seat: action.seat, reason: 'finished' });
    }
    return { state: ended, events };
  }

  const clocked: BattleState = { ...state, now: action.at };
  if (action.type === 'tick') {
    return { state: clocked, events: [] };
  }
  return answer(clocked, action);
}

function answer(
  state: BattleState,
  action: Extract<BattleAction, { type: 'answer' }>,
): BattleUpdate {
  const { rules } = state;
  const { seat, at } = action;
  const player = state.players[seat];

  if (action.questionIndex !== player.questionIndex) {
    return { state, events: [{ type: 'rejected', seat, reason: 'stale-question' }] };
  }
  if (at < player.lockedUntil) {
    return { state, events: [{ type: 'rejected', seat, reason: 'locked' }] };
  }

  const question = generateQuestion(state.seed, player.questionIndex, state.level);
  const nextIndex = player.questionIndex + 1;

  if (action.value !== question.answer) {
    // Wrong: combo resets, input locks, and the next question shows when the lock ends.
    const lockedUntil = at + rules.wrongAnswerLockMs;
    const missed: PlayerState = {
      ...player,
      questionIndex: nextIndex,
      questionShownAt: lockedUntil,
      streak: 0,
      comboReady: false,
      run: 0,
      lockedUntil,
      wrong: player.wrong + 1,
    };
    return {
      state: { ...state, players: withPlayer(state.players, seat, missed) },
      events: [{ type: 'miss', seat, questionIndex: player.questionIndex, lockedUntil }],
    };
  }

  const speedBonus = at - player.questionShownAt < rules.speedBonusWindowMs;
  const combo = player.comboReady;
  const damage =
    (rules.damage + (speedBonus ? rules.speedBonus : 0)) * (combo ? rules.comboMultiplier : 1);

  // A combo hit spends the charge and restarts the streak; otherwise the streak grows.
  const streak = combo ? 0 : player.streak + 1;
  const comboReady = !combo && streak >= rules.comboStreak;

  const attacker: PlayerState = {
    ...player,
    questionIndex: nextIndex,
    questionShownAt: at,
    streak,
    comboReady,
    run: player.run + 1,
    correct: player.correct + 1,
    bestStreak: Math.max(player.bestStreak, player.run + 1),
  };
  const targetSeat = other(seat);
  const target = state.players[targetSeat];
  const targetHp = Math.max(0, target.hp - damage);

  let players = withPlayer(state.players, seat, attacker);
  players = withPlayer(players, targetSeat, { ...target, hp: targetHp });

  const events: BattleEvent[] = [
    { type: 'hit', seat, questionIndex: player.questionIndex, damage, speedBonus, combo, targetHp },
  ];
  if (comboReady) {
    events.push({ type: 'combo-ready', seat });
  }
  let result: BattleResult | null = null;
  if (targetHp === 0) {
    result = { outcome: 'win', winner: seat, reason: 'ko' };
    events.push({ type: 'end', result });
  }
  return { state: { ...state, players, result }, events };
}
