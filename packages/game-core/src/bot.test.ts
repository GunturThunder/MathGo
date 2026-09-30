import { describe, expect, it } from 'vitest';
import { ARENAS, type ArenaId } from './arenas.js';
import { applyBattleAction, createBattle, type BattleState } from './battle.js';
import {
  BOT_DIFFICULTIES,
  BOT_PROFILES,
  planBotAnswer,
  simulateBotBattle,
  type Bot,
  type BotDifficulty,
} from './bot.js';
import { generateQuestion } from './generator.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => (i * 2_654_435_761) >>> 0);

const levelOf = (arena: ArenaId) => ({ arena, trophies: ARENAS[arena - 1]?.minTrophies ?? 0 });

const battle = (arena: ArenaId, seed: number, a: BotDifficulty, b: BotDifficulty) =>
  simulateBotBattle({
    seed,
    level: levelOf(arena),
    bots: [
      { difficulty: a, seed: (seed ^ 0x1111) >>> 0 },
      { difficulty: b, seed: (seed ^ 0x2222) >>> 0 },
    ],
  });

describe('BOT_PROFILES', () => {
  it('has 3 difficulty levels for every arena, harder ones faster and more accurate', () => {
    for (const arena of ARENAS) {
      const [easy, medium, hard] = BOT_DIFFICULTIES.map((d) => BOT_PROFILES[arena.id][d]);
      expect(easy && medium && hard).toBeTruthy();
      if (!easy || !medium || !hard) continue;
      expect(hard.thinkMs.max).toBeLessThanOrEqual(medium.thinkMs.max);
      expect(medium.thinkMs.max).toBeLessThanOrEqual(easy.thinkMs.max);
      expect(hard.errorRate).toBeLessThan(medium.errorRate);
      expect(medium.errorRate).toBeLessThan(easy.errorRate);
    }
  });

  it('medium never thinks under 7.5 s, so it cannot KO another medium bot before 60 s', () => {
    for (const arena of ARENAS) {
      expect(BOT_PROFILES[arena.id].medium.thinkMs.min).toBeGreaterThanOrEqual(7_500);
    }
  });
});

describe('simulated bot battles', () => {
  it.each(ARENAS.map((a) => a.id))(
    'arena %i: medium vs medium lasts 60–90 s in every one of 200 battles',
    (arena) => {
      for (const seed of SEEDS) {
        const state = battle(arena, seed, 'medium', 'medium');
        expect(state.result).not.toBeNull();
        expect(state.now).toBeGreaterThanOrEqual(60_000);
        expect(state.now).toBeLessThanOrEqual(90_000);
      }
    },
  );

  it('hard beats easy in most battles', () => {
    for (const arena of ARENAS) {
      const wins = SEEDS.filter((seed) => {
        const { result } = battle(arena.id, seed, 'hard', 'easy');
        return result?.outcome === 'win' && result.winner === 0;
      }).length;
      expect(wins / SEEDS.length).toBeGreaterThan(0.9);
    }
  });

  it('is deterministic for the same seeds', () => {
    expect(battle(3, 42, 'medium', 'hard')).toEqual(battle(3, 42, 'medium', 'hard'));
  });
});

describe('planBotAnswer', () => {
  const bot: Bot = { difficulty: 'medium', seed: 7 };

  it('answers the current question within the think-time range', () => {
    const state = createBattle({ seed: 99, level: levelOf(2) });
    const plan = planBotAnswer(state, 1, bot);
    const { min, max } = BOT_PROFILES[2].medium.thinkMs;
    expect(plan.questionIndex).toBe(0);
    expect(plan.at).toBeGreaterThanOrEqual(min);
    expect(plan.at).toBeLessThanOrEqual(max);
  });

  it('gets answers wrong at about its error rate', () => {
    for (const difficulty of BOT_DIFFICULTIES) {
      const level = levelOf(4);
      let state: BattleState = createBattle({ seed: 5, level });
      let wrong = 0;
      const answers = 2_000;
      for (let q = 0; q < answers; q++) {
        // Walk the questions with a fresh state per question; only the index matters here.
        state = {
          ...state,
          players: [{ ...state.players[0], questionIndex: q }, state.players[1]],
        };
        const plan = planBotAnswer(state, 0, { difficulty, seed: 123 });
        if (plan.value !== generateQuestion(5, q, level).answer) wrong++;
      }
      expect(Math.abs(wrong / answers - BOT_PROFILES[4][difficulty].errorRate)).toBeLessThan(0.03);
    }
  });

  it('waits for the wrong-answer lock to end before the next answer', () => {
    const start = createBattle({ seed: 99, level: levelOf(1) });
    const wrongAt = 20_000;
    const answer = generateQuestion(99, 0, start.level).answer;
    const locked = applyBattleAction(start, {
      type: 'answer',
      seat: 0,
      questionIndex: 0,
      value: answer + 1,
      at: wrongAt,
    }).state;
    const plan = planBotAnswer(locked, 0, bot);
    expect(plan.questionIndex).toBe(1);
    expect(plan.at).toBeGreaterThanOrEqual(locked.players[0].lockedUntil + 7_500);
  });

  it('never plans an answer in the past', () => {
    const start = createBattle({ seed: 1, level: levelOf(1) });
    const late = applyBattleAction(start, { type: 'tick', at: 50_000 }).state;
    expect(planBotAnswer(late, 0, bot).at).toBeGreaterThan(50_000);
  });
});
