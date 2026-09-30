import { errors, jwtVerify, SignJWT } from 'jose';

/**
 * Access tokens and the online-play rule, shared by api (which signs) and game-server (which
 * checks joins, S3-05). Both use the same JWT_SECRET.
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Local-development secret shared by api and game-server. Both refuse it in production. */
export const DEV_JWT_SECRET = 'dev-only-jwt-secret-change-me-0123456789';

const ISSUER = 'mathgo-api';
const AUDIENCE = 'mathgo';
const ALGORITHM = 'HS256';

export type SigningKey = Uint8Array;

export function signingKey(secret: string): SigningKey {
  return new TextEncoder().encode(secret);
}

export interface AccessClaims {
  readonly userId: string;
  /** May play online: an adult, or a minor with active parent consent (FR-20). */
  readonly online: boolean;
}

export interface IssuedToken {
  readonly token: string;
  readonly expiresAt: Date;
}

/** Why a token or player is refused. Codes match `@mathgo/protocol`'s error codes. */
export type AuthErrorCode = 'invalid-token' | 'token-expired' | 'consent-required';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function signAccessToken(
  claims: AccessClaims,
  key: SigningKey,
  now: Date,
): Promise<IssuedToken> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ typ: 'access', online: claims.online })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key);
  return { token, expiresAt: new Date(expiresAt * 1000) };
}

/** The claims of a valid access token; throws `AuthError` otherwise. */
export async function verifyAccessToken(
  token: string,
  key: SigningKey,
  now: Date,
): Promise<AccessClaims> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    }));
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new AuthError('token-expired', 'The access token has expired; refresh it.');
    }
    throw new AuthError('invalid-token', 'The access token is not valid.');
  }
  if (payload['typ'] !== 'access' || typeof payload.sub !== 'string') {
    throw new AuthError('invalid-token', 'Not an access token.');
  }
  // A token without the claim (or with anything but `true`) never grants online play.
  return { userId: payload.sub, online: payload['online'] === true };
}

/**
 * Matchmaking and battle rooms call this before letting a player in (FR-20, PP Tunas): minors
 * without parent consent play offline only.
 */
export function requireOnlinePlay(claims: AccessClaims): void {
  if (!claims.online) {
    throw new AuthError('consent-required', 'A parent must approve online play first.');
  }
}

/**
 * Adult for online play. Only the birth year is known, so a player counts as an adult from the
 * year they turn 19: the first year they are certainly 18. Cautious on purpose (PP Tunas).
 */
export function isAdult(birthYear: number, now: Date): boolean {
  return now.getUTCFullYear() - birthYear >= 19;
}
