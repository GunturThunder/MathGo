import {
  applyBattleAction,
  createBattle,
  planBotAnswer,
  type ArenaId,
  type BattleEvent,
  type BattleState,
  type Bot,
  type BotAnswer,
  type BotDifficulty,
} from '@mathgo/game-core';

// Practice vs bot (S2-10, FR-13): the whole battle runs on the phone with game-core, offline.
// The player is seat 0, the bot seat 1. Nothing here touches trophies.

export const PLAYER_SEAT = 0;
export const BOT_SEAT = 1;

/** Questions come from the middle of the chosen arena. */
export const PRACTICE_TROPHIES: Record<ArenaId, number> = {
  1: 150,
  2: 500,
  3: 950,
  4: 1500,
  5: 2000,
};

export interface Practice {
  readonly state: BattleState;
  readonly bot: Bot;
  /** The bot's planned answer to its current question; planned once per question. */
  readonly plan: BotAnswer;
}

export interface PracticeUpdate {
  readonly practice: Practice;
  readonly events: readonly BattleEvent[];
}

export interface NewPractice {
  readonly arena: ArenaId;
  readonly difficulty: BotDifficulty;
  /** Match seed and the bot's own seed (uint32). */
  readonly seed: number;
  readonly botSeed: number;
}

export function startPractice({ arena, difficulty, seed, botSeed }: NewPractice): Practice {
  const state = createBattle({ seed, level: { arena, trophies: PRACTICE_TROPHIES[arena] } });
  const bot: Bot = { difficulty, seed: botSeed };
  return { state, bot, plan: planBotAnswer(state, BOT_SEAT, bot) };
}

/**
 * Plans again only when the bot is on a new question or a new lock: planBotAnswer counts from
 * the clock, so replanning every tick would keep pushing the bot's answer back.
 */
function replan(practice: Practice, state: BattleState): Practice {
  const before = practice.state.players[BOT_SEAT];
  const after = state.players[BOT_SEAT];
  const same =
    before.questionIndex === after.questionIndex && before.lockedUntil === after.lockedUntil;
  return {
    ...practice,
    state,
    plan: same ? practice.plan : planBotAnswer(state, BOT_SEAT, practice.bot),
  };
}

/** Moves the clock to `now`: the bot answers if its time has come, then the battle ticks. */
export function advance(practice: Practice, now: number): PracticeUpdate {
  let current = practice;
  const events: BattleEvent[] = [];
  // The bot may owe more than one answer if the app stalled (e.g. it was in the background).
  while (current.state.result === null && current.plan.at <= now) {
    const update = applyBattleAction(current.state, {
      type: 'answer',
      seat: BOT_SEAT,
      ...current.plan,
    });
    events.push(...update.events);
    current = replan(current, update.state);
  }
  if (current.state.result === null) {
    const update = applyBattleAction(current.state, { type: 'tick', at: now });
    events.push(...update.events);
    current = replan(current, update.state);
  }
  return { practice: current, events };
}

/** The player's answer at `now`. */
export function answer(practice: Practice, value: number, now: number): PracticeUpdate {
  const caughtUp = advance(practice, now);
  if (caughtUp.practice.state.result !== null) return caughtUp;
  const state = caughtUp.practice.state;
  const update = applyBattleAction(state, {
    type: 'answer',
    seat: PLAYER_SEAT,
    questionIndex: state.players[PLAYER_SEAT].questionIndex,
    value,
    at: now,
  });
  return {
    practice: replan(caughtUp.practice, update.state),
    events: [...caughtUp.events, ...update.events],
  };
}
