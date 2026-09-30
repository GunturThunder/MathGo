import {
  AuthError,
  requireOnlinePlay,
  verifyAccessToken,
  type AccessClaims,
  type SigningKey,
} from '@mathgo/auth';
import { PROTOCOL_VERSION, joinRequest, type ErrorCode } from '@mathgo/protocol';

/** HTTP-style status sent with each join refusal; the message is the protocol error code. */
const STATUS: Partial<Record<ErrorCode, number>> = {
  'invalid-message': 400,
  'invalid-token': 401,
  'token-expired': 401,
  'consent-required': 403,
  'update-required': 426,
};

export class JoinRefused extends Error {
  readonly status: number;

  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = 'JoinRefused';
    this.status = STATUS[code] ?? 400;
  }
}

/**
 * Checks a join before any room is touched: well-formed options, a current app version, a
 * valid access token, and permission to play online (FR-20). Returns the player's claims.
 */
export async function authorizeJoin(
  options: unknown,
  key: SigningKey,
  now: Date,
): Promise<AccessClaims> {
  // Store builds lag behind server deploys: an older app gets "please update" (S4-12). Checked
  // before the schema, because an older app's join options may not match today's shape.
  const version = (options as { protocolVersion?: unknown } | null)?.protocolVersion;
  if (typeof version === 'number' && version < PROTOCOL_VERSION) {
    throw new JoinRefused('update-required');
  }
  const parsed = joinRequest.safeParse(options);
  if (!parsed.success) {
    throw new JoinRefused('invalid-message');
  }
  try {
    const claims = await verifyAccessToken(parsed.data.token, key, now);
    requireOnlinePlay(claims);
    return claims;
  } catch (error) {
    if (error instanceof AuthError) throw new JoinRefused(error.code);
    throw error;
  }
}
