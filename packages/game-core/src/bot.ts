import type { ArenaId } from './arenas.js';
import {
  applyBattleAction,
  createBattle,
  type BattleRules,
  type BattleState,
  type Seat,
} from './battle.js';
import type { QuestionLevel } from './difficulty.js';
import { generateQuestion } from './generator.js';
import { createRng } from './rng.js';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'medium', 'hard'];

export interface BotProfile {
  /** Time to answer once a question shows, drawn evenly from this range (ms, inclusive). */
  readonly thinkMs: { readonly min: number; readonly max: number };
  /** Share of answers that are wrong, 0 to 1. */
  readonly errorRate: number;
}

/**
 * Starting values, tuned at the fun gate (S2-15). Harder arenas think longer and slip more.
 * Medium never thinks faster than 7.5 s: 100 HP takes at least eight 10-damage hits, so a medium
 * bot cannot knock out another medium bot before 60 s, and battles run the full 60–90 s.
 */
export const BOT_PROFILES: Readonly<Record<ArenaId, Readonly<Record<BotDifficulty, BotProfile>>>> =
  {
    1: {
      easy: { thinkMs: { min: 9_000, max: 14_000 }, errorRate: 0.2 },
      medium: { thinkMs: { min: 7_500, max: 10_000 }, errorRate: 0.08 },
      hard: { thinkMs: { min: 2_500, max: 5_000 }, errorRate: 0.03 },
    },
    2: {
      easy: { thinkMs: { min: 10_000, max: 15_000 }, errorRate: 0.22 },
      medium: { thinkMs: { min: 7_500, max: 10_500 }, errorRate: 0.1 },
      hard: { thinkMs: { min: 3_000, max: 5_500 }, errorRate: 0.04 },
    },
    3: {
      easy: { thinkMs: { min: 11_000, max: 16_000 }, errorRate: 0.25 },
      medium: { thinkMs: { min: 7_500, max: 11_000 }, errorRate: 0.12 },
      hard: { thinkMs: { min: 3_000, max: 6_000 }, errorRate: 0.05 },
    },
    4: {
      easy: { thinkMs: { min: 12_000, max: 18_000 }, errorRate: 0.28 },
      medium: { thinkMs: { min: 8_000, max: 12_000 }, errorRate: 0.15 },
      hard: { thinkMs: { min: 3_500, max: 7_000 }, errorRate: 0.06 },
    },
    5: {
      easy: { thinkMs: { min: 13_000, max: 20_000 }, errorRate: 0.3 },
      medium: { thinkMs: { min: 8_500, max: 13_000 }, errorRate: 0.18 },
      hard: { thinkMs: { min: 4_000, max: 8_000 }, errorRate: 0.08 },
    },
  };

export interface Bot {
  readonly difficulty: BotDifficulty;
  /** The bot's own seed, separate from the match seed, so its timing isn't tied to the questions. */
  readonly seed: number;
}

export interface BotAnswer {
  readonly questionIndex: number;
  readonly value: number;
  /** When to submit, in ms from the battle start. */
  readonly at: number;
}

/** Plausible slips: off by one or two, or by ten. */
const SLIPS = [-10, -2, -1, 1, 2, 10] as const;

/**
 * The bot's answer to its current question. Deterministic: the same bot, battle and question
 * always give the same answer and timing, so a practice battle can be replayed.
 */
export function planBotAnswer(state: BattleState, seat: Seat, bot: Bot): BotAnswer {
  const player = state.players[seat];
  const profile = BOT_PROFILES[state.level.arena][bot.difficulty];
  const rng = createRng(bot.seed, player.questionIndex);

  const think = rng.int(profile.thinkMs.min, profile.thinkMs.max);
  const answer = generateQuestion(state.seed, player.questionIndex, state.level).answer;
  const value = rng.chance(profile.errorRate) ? answer + rng.pick(SLIPS) : answer;
  // The question shows when the previous one was answered, or when the wrong-answer lock ends.
  const at = Math.max(player.questionShownAt, player.lockedUntil, state.now) + think;
  return { questionIndex: player.questionIndex, value, at };
}

export interface BotBattle {
  readonly seed: number;
  readonly level: QuestionLevel;
  readonly bots: readonly [Bot, Bot];
  readonly rules?: BattleRules;
}

/** Plays a whole battle between two bots, for tuning and tests. Returns the finished state. */
export function simulateBotBattle({ seed, level, bots, rules }: BotBattle): BattleState {
  let state = createBattle({ seed, level, ...(rules === undefined ? {} : { rules }) });
  while (state.result === null) {
    const plans = [planBotAnswer(state, 0, bots[0]), planBotAnswer(state, 1, bots[1])] as const;
    // The earlier answer lands first; seat 0 wins a tie.
    const seat: Seat = plans[1].at < plans[0].at ? 1 : 0;
    const plan = plans[seat];
    state =
      plan.at >= state.rules.durationMs
        ? applyBattleAction(state, { type: 'tick', at: state.rules.durationMs }).state
        : applyBattleAction(state, { type: 'answer', seat, ...plan }).state;
  }
  return state;
}
