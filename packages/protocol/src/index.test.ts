import {
  applyBattleAction,
  createBattle,
  generateQuestion,
  type BattleEvent,
  type BattleResult,
} from '@mathgo/game-core';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  PROTOCOL_VERSION,
  answerRequest,
  battleEnd,
  joinRequest,
  parseClientMessage,
  matchWindow,
  parseServerMessage,
  questionBatch,
  type BattleEnd,
  type StateUpdate,
} from './index.js';

describe('client messages', () => {
  it('accepts a join and an answer', () => {
    expect(joinRequest.parse({ protocolVersion: PROTOCOL_VERSION, token: 'jwt' })).toEqual({
      protocolVersion: 1,
      token: 'jwt',
    });
    expect(parseClientMessage('answer', { questionIndex: 3, value: -12 })).toEqual({
      ok: true,
      message: { type: 'answer', payload: { questionIndex: 3, value: -12 } },
    });
  });

  it('rejects answers that are not whole numbers in range, or carry extra fields', () => {
    for (const bad of [
      { questionIndex: 0, value: 1.5 },
      { questionIndex: -1, value: 1 },
      { questionIndex: 0, value: 100_000 },
      { questionIndex: 0, value: '7' },
      { questionIndex: 0, value: 7, answer: 7 },
      null,
    ]) {
      expect(answerRequest.safeParse(bad).success).toBe(false);
    }
  });

  it('reports unknown message types and schema failures as errors, never throws', () => {
    expect(parseClientMessage('cheat', {})).toEqual({
      ok: false,
      error: 'Unknown message type "cheat"',
    });
    expect(parseClientMessage('toString', {}).ok).toBe(false);
    const bad = parseClientMessage('answer', { questionIndex: 'x', value: 1 });
    expect(bad.ok).toBe(false);
    expect(bad.ok ? '' : bad.error).toContain('questionIndex');
  });
});

describe('server messages', () => {
  it('question batches carry text only, never answers', () => {
    const q = generateQuestion(1, 0, { arena: 3, trophies: 700 });
    expect(questionBatch.safeParse({ questions: [{ index: 0, text: q.text }] }).success).toBe(true);
    expect(
      questionBatch.safeParse({ questions: [{ index: 0, text: q.text, answer: q.answer }] })
        .success,
    ).toBe(false);
  });

  it('a real engine state and its events make a valid state update', () => {
    const level = { arena: 1, trophies: 0 } as const;
    let state = createBattle({ seed: 5, level });
    const answer = generateQuestion(5, 0, level).answer;
    const update = applyBattleAction(state, {
      type: 'answer',
      seat: 0,
      questionIndex: 0,
      value: answer,
      at: 1_000,
    });
    state = update.state;
    const message: StateUpdate = {
      now: state.now,
      players: [
        {
          hp: state.players[0].hp,
          streak: state.players[0].streak,
          comboReady: state.players[0].comboReady,
          lockedUntil: state.players[0].lockedUntil,
          questionIndex: state.players[0].questionIndex,
        },
        {
          hp: state.players[1].hp,
          streak: state.players[1].streak,
          comboReady: state.players[1].comboReady,
          lockedUntil: state.players[1].lockedUntil,
          questionIndex: state.players[1].questionIndex,
        },
      ],
      events: update.events.filter((e) => e.type !== 'end'),
    };
    expect(parseServerMessage('state', message).ok).toBe(true);
  });

  it('a battle end with and without trophy changes', () => {
    const end: BattleEnd = {
      result: { outcome: 'win', winner: 0, reason: 'ko' },
      stats: [
        { correct: 8, wrong: 1, bestStreak: 5 },
        { correct: 3, wrong: 4, bestStreak: 2 },
      ],
      trophies: null,
    };
    expect(battleEnd.safeParse(end).success).toBe(true);
    expect(
      battleEnd.safeParse({
        ...end,
        trophies: [
          { delta: 30, trophies: 330, arenaBefore: 1, arenaAfter: 2 },
          { delta: -20, trophies: 280, arenaBefore: 1, arenaAfter: 1 },
        ],
      }).success,
    ).toBe(true);
    expect(
      battleEnd.safeParse({ ...end, result: { outcome: 'draw', winner: 0, reason: 'time' } })
        .success,
    ).toBe(false);
  });

  it('the countdown before a battle: whole milliseconds, at most 10 s (S4-10)', () => {
    expect(parseServerMessage('countdown', { startsInMs: 3_000 }).ok).toBe(true);
    expect(parseServerMessage('countdown', { startsInMs: 0 }).ok).toBe(true);
    for (const bad of [{ startsInMs: -1 }, { startsInMs: 1.5 }, { startsInMs: 60_000 }, {}]) {
      expect(parseServerMessage('countdown', bad).ok).toBe(false);
    }
  });

  it('errors are codes from a fixed list', () => {
    expect(parseServerMessage('error', { code: 'update-required' }).ok).toBe(true);
    expect(parseServerMessage('error', { code: 'something-else' }).ok).toBe(false);
  });
});

describe('matchmaking window (FR-02)', () => {
  it('±100, widening by 50 every 5 s', () => {
    expect(matchWindow(0)).toBe(100);
    expect(matchWindow(4_999)).toBe(100);
    expect(matchWindow(5_000)).toBe(150);
    expect(matchWindow(30_000)).toBe(400);
    expect(matchWindow(-10)).toBe(100);
  });
});

describe('stays in step with game-core', () => {
  it('every engine event except "end" fits a state update, and every result fits a battle end', () => {
    expectTypeOf<Exclude<BattleEvent, { type: 'end' }>>().toExtend<StateUpdate['events'][number]>();
    expectTypeOf<BattleResult>().toExtend<BattleEnd['result']>();
  });
});
