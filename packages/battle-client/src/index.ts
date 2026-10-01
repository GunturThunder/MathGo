import { Client, type Room } from '@colyseus/sdk';
import {
  BATTLE_ROOM,
  ERROR_CODES,
  PROTOCOL_VERSION,
  parseServerMessage,
  type ErrorCode,
  type ServerMessage,
} from '@mathgo/protocol';

/** A join the server refused, with the protocol error code to show (or `connection-failed`). */
export class JoinError extends Error {
  constructor(
    readonly code: ErrorCode | 'connection-failed',
    readonly status?: number,
  ) {
    super(code);
    this.name = 'JoinError';
  }
}

export interface BattleClientOptions {
  /** game-server's WebSocket address, e.g. `ws://localhost:2567`. */
  readonly endpoint: string;
  /** A fresh access token; `forceRefresh` when the server said `token-expired`. */
  readonly getToken: (forceRefresh: boolean) => Promise<string>;
}

export interface BattleHandlers {
  /** Every server message, already checked against @mathgo/protocol. */
  readonly onMessage: (message: ServerMessage) => void;
  /** The connection dropped; the SDK is trying to reconnect (S4-11). */
  readonly onDrop?: (code: number) => void;
  /** Back in the room after a drop. */
  readonly onReconnect?: () => void;
  /** Left for good: the battle ended, the player left, or reconnecting failed. */
  readonly onLeave?: (code: number) => void;
  /** A message that does not match the protocol (a bug or a version mismatch). */
  readonly onInvalidMessage?: (type: string, error: string) => void;
}

export interface BattleConnection {
  readonly roomId: string;
  sendAnswer(questionIndex: number, value: number): void;
  leave(): Promise<void>;
}

const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);

/**
 * Joins a battle (a given room, or any open one) and wires the handlers. Join refusals become
 * `JoinError` with the protocol code; an expired token is refreshed and the join retried once.
 */
export async function joinBattle(
  options: BattleClientOptions,
  handlers: BattleHandlers,
  roomId?: string,
): Promise<BattleConnection> {
  const client = new Client(options.endpoint);

  const attempt = async (forceRefresh: boolean): Promise<Room> => {
    const joinOptions = {
      protocolVersion: PROTOCOL_VERSION,
      token: await options.getToken(forceRefresh),
    };
    try {
      return roomId === undefined
        ? await client.joinOrCreate(BATTLE_ROOM, joinOptions)
        : await client.joinById(roomId, joinOptions);
    } catch (error) {
      const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
      if (isErrorCode(message)) {
        throw new JoinError(message, typeof code === 'number' ? code : undefined);
      }
      throw new JoinError('connection-failed');
    }
  };

  let room: Room;
  try {
    room = await attempt(false);
  } catch (error) {
    if (!(error instanceof JoinError) || error.code !== 'token-expired') throw error;
    room = await attempt(true);
  }

  room.onMessage('*', (type: string | number, payload: unknown) => {
    const parsed = parseServerMessage(String(type), payload);
    if (parsed.ok) handlers.onMessage(parsed.message);
    else handlers.onInvalidMessage?.(String(type), parsed.error);
  });
  room.onDrop((code: number) => handlers.onDrop?.(code));
  room.onReconnect(() => handlers.onReconnect?.());
  room.onLeave((code: number) => handlers.onLeave?.(code));

  return {
    roomId: room.roomId,
    sendAnswer: (questionIndex, value) => room.send('answer', { questionIndex, value }),
    leave: async () => {
      await room.leave(true);
    },
  };
}
