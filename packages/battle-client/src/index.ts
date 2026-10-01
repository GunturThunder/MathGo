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

/** game-server's HTTP address, from its WebSocket one (ws → http, wss → https). */
export function httpBase(endpoint: string): string {
  return endpoint.replace(/^ws(s?):\/\//, 'http$1://');
}

export interface Invite {
  readonly code: string;
  readonly roomId: string;
  /** ISO time; the code stays alive while the room is used. */
  readonly expiresAt: string;
}

async function errorCodeOf(res: Response): Promise<ErrorCode | 'connection-failed'> {
  const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
  return isErrorCode(body?.code) ? body.code : 'connection-failed';
}

/** Creates a private battle room for a friend to join by code (S4-08). */
export async function createInvite(options: BattleClientOptions): Promise<Invite> {
  const post = async (forceRefresh: boolean) =>
    fetch(`${httpBase(options.endpoint)}/invites`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await options.getToken(forceRefresh)}` },
    }).catch(() => null);
  let res = await post(false);
  if (res !== null && res.status === 401 && (await errorCodeOf(res.clone())) === 'token-expired') {
    res = await post(true);
  }
  if (res === null) throw new JoinError('connection-failed');
  if (!res.ok) throw new JoinError(await errorCodeOf(res), res.status);
  return (await res.json()) as Invite;
}

/**
 * Joins a friend's room by its 6-character code (S4-09). An unknown or expired code throws
 * JoinError `room-not-found` / `room-expired`.
 */
export async function joinByCode(
  options: BattleClientOptions,
  handlers: BattleHandlers,
  code: string,
): Promise<BattleConnection> {
  const res = await fetch(
    `${httpBase(options.endpoint)}/invites/${encodeURIComponent(code.trim().toUpperCase())}`,
  ).catch(() => null);
  if (res === null) throw new JoinError('connection-failed');
  if (!res.ok) throw new JoinError(await errorCodeOf(res), res.status);
  const { roomId } = (await res.json()) as { roomId: string };
  return joinBattle(options, handlers, roomId);
}
