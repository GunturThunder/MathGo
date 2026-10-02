import {
  applyBattleAction,
  generateQuestion,
  planBotAnswer,
  type BattleEvent,
} from '@mathgo/game-core';
import { BOT_SEAT, PLAYER_SEAT, advance, answer, startPractice, type Practice } from './practice';

const start = () => startPractice({ arena: 3, difficulty: 'medium', seed: 11, botSeed: 22 });
const rightAnswer = (p: Practice) =>
  generateQuestion(p.state.seed, p.state.players[PLAYER_SEAT].questionIndex, p.state.level).answer;

/** Advances in 100 ms steps, as the screen does. */
function runTo(p: Practice, until: number, from = 0): Practice {
  let current = p;
  for (let t = from; t <= until && current.state.result === null; t += 100)
    current = advance(current, t).practice;
  return current;
}

describe('practice vs bot (S2-10)', () => {
  /** The bot's answers against an idle player, straight from planBotAnswer: the reference. */
  function referenceTimeline(): number[] {
    const first = start();
    let state = first.state;
    const times: number[] = [];
    while (state.result === null) {
      const plan = planBotAnswer(state, BOT_SEAT, first.bot);
      if (plan.at >= state.rules.durationMs) break;
      state = applyBattleAction(state, { type: 'answer', seat: BOT_SEAT, ...plan }).state;
      // When its next question shows: right after a right answer, after the lock if wrong.
      times.push(state.players[BOT_SEAT].questionShownAt);
    }
    return times;
  }

  it('ticking every 100 ms never delays the bot: it answers exactly when planned', () => {
    let p = start();
    const times: number[] = [];
    for (let t = 0; t <= 90_000 && p.state.result === null; t += 100) {
      const update = advance(p, t);
      for (const e of update.events as BattleEvent[]) {
        if ((e.type === 'hit' || e.type === 'miss') && e.seat === BOT_SEAT) {
          times.push(update.practice.state.players[BOT_SEAT].questionShownAt);
        }
      }
      p = update.practice;
    }
    const expected = referenceTimeline();
    expect(times.length).toBeGreaterThan(5);
    expect(times).toEqual(expected.slice(0, times.length));
  });

  it('the bot hits the player', () => {
    const p = runTo(start(), 60_000);
    expect(p.state.players[PLAYER_SEAT].hp).toBeLessThan(100);
  });

  it('the player answers: right hits the bot, wrong locks', () => {
    let p = start();
    p = answer(p, rightAnswer(p), 1_000).practice;
    expect(p.state.players[BOT_SEAT].hp).toBe(85); // fast hit: 10 + 5
    const { practice, events } = answer(p, -1, 2_000);
    expect(events.some((e) => e.type === 'miss' && e.seat === PLAYER_SEAT)).toBe(true);
    expect(practice.state.players[PLAYER_SEAT].lockedUntil).toBe(3_000);
  });

  it('the player can win by knockout', () => {
    let p = start();
    for (let i = 0; i < 20 && p.state.result === null; i++)
      p = answer(p, rightAnswer(p), 500 + i * 400).practice;
    expect(p.state.result).toMatchObject({ outcome: 'win', winner: PLAYER_SEAT, reason: 'ko' });
  });

  it('after a stall (app in the background) the bot catches up: same battle as running live', () => {
    const jumped = advance(start(), 40_000);
    expect(
      jumped.events.filter((e) => e.type === 'hit' || e.type === 'miss').length,
    ).toBeGreaterThan(2);
    expect(jumped.practice.state).toEqual(runTo(start(), 40_000).state);
  });

  it('time runs out at 90 s', () => {
    const p = advance(start(), 95_000);
    expect(p.practice.state.result).not.toBeNull();
    expect(p.events.at(-1)?.type).toBe('end');
  });

  it('deterministic: the same seeds give the same battle', () => {
    expect(runTo(start(), 40_000).state).toEqual(runTo(start(), 40_000).state);
  });
});
