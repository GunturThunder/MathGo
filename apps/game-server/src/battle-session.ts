import {
  applyBattleAction,
  createBattle,
  generateQuestion,
  type BattleEvent,
  type BattleState,
  type BattleUpdate,
  type QuestionLevel,
  type Seat,
} from '@mathgo/game-core';
import {
  parseClientMessage,
  type BattleEnd,
  type ServerMessage,
  type StateUpdate,
} from '@mathgo/protocol';

/** Questions each player always has waiting, so the next one shows instantly. */
export const QUEUED_QUESTIONS = 3;

export interface Outgoing {
  readonly to: Seat | 'all';
  readonly message: ServerMessage;
}

/**
 * One battle without networking: validates client messages with `@mathgo/protocol`, runs the
 * `game-core` engine and says what to send to whom. BattleRoom owns the clock and the sockets.
 */
export class BattleSession {
  private state: BattleState;
  /** Highest question index already sent, per seat. */
  private readonly sent: [number, number] = [-1, -1];

  constructor(seed: number, level: QuestionLevel) {
    this.state = createBattle({ seed, level });
  }

  get battle(): BattleState {
    return this.state;
  }

  /** Sent when a player takes a seat. */
  welcome(seat: Seat): Outgoing[] {
    return [
      {
        to: seat,
        message: {
          type: 'joined',
          payload: {
            seat,
            arena: this.state.level.arena,
            durationMs: this.state.rules.durationMs,
          },
        },
      },
    ];
  }

  /** Both seats are taken and the clock starts: each player gets the first questions. */
  start(): Outgoing[] {
    return [...this.topUpQuestions(0), ...this.topUpQuestions(1)];
  }

  receive(seat: Seat, type: string, payload: unknown, at: number): Outgoing[] {
    const parsed = parseClientMessage(type, payload);
    if (!parsed.ok) {
      return [
        {
          to: seat,
          message: { type: 'error', payload: { code: 'invalid-message', detail: parsed.error } },
        },
      ];
    }
    const { questionIndex, value } = parsed.message.payload;
    return this.apply(
      applyBattleAction(this.state, { type: 'answer', seat, questionIndex, value, at }),
      seat,
    );
  }

  tick(at: number): Outgoing[] {
    return this.apply(applyBattleAction(this.state, { type: 'tick', at }), null);
  }

  private apply(update: BattleUpdate, seat: Seat | null): Outgoing[] {
    const before = this.state;
    this.state = update.state;
    if (update.events.length === 0) {
      return [];
    }
    const out: Outgoing[] = [];
    const events = update.events.filter(
      (e): e is Exclude<BattleEvent, { type: 'end' }> => e.type !== 'end',
    );
    // A rejected answer only concerns its sender; everything else goes to both players.
    const shared = events.filter((e) => e.type !== 'rejected');
    const rejected = events.filter((e) => e.type === 'rejected');
    if (shared.length > 0) {
      out.push({ to: 'all', message: { type: 'state', payload: this.view(shared) } });
    }
    if (rejected.length > 0 && seat !== null) {
      out.push({ to: seat, message: { type: 'state', payload: this.view(rejected) } });
    }
    if (this.state.result === null) {
      if (seat !== null) out.push(...this.topUpQuestions(seat));
    } else if (before.result === null) {
      out.push({ to: 'all', message: { type: 'end', payload: this.end() } });
    }
    return out;
  }

  private topUpQuestions(seat: Seat): Outgoing[] {
    const current = this.state.players[seat].questionIndex;
    const last = current + QUEUED_QUESTIONS - 1;
    const questions = [];
    for (let index = Math.max(current, this.sent[seat] + 1); index <= last; index++) {
      questions.push({
        index,
        text: generateQuestion(this.state.seed, index, this.state.level).text,
      });
    }
    if (questions.length === 0) {
      return [];
    }
    this.sent[seat] = last;
    return [{ to: seat, message: { type: 'questions', payload: { questions } } }];
  }

  private view(events: StateUpdate['events']): StateUpdate {
    const player = (seat: Seat) => {
      const { hp, streak, comboReady, lockedUntil, questionIndex } = this.state.players[seat];
      return { hp, streak, comboReady, lockedUntil, questionIndex };
    };
    return { now: this.state.now, players: [player(0), player(1)], events };
  }

  private end(): BattleEnd {
    const result = this.state.result;
    if (result === null) {
      throw new Error('end() before the battle finished');
    }
    const stats = (seat: Seat) => {
      const { correct, wrong, bestStreak } = this.state.players[seat];
      return { correct, wrong, bestStreak };
    };
    // Trophies are settled with the ranked-match flow (S5-03); invite and stub battles give none.
    return { result, stats: [stats(0), stats(1)], trophies: null };
  }
}
