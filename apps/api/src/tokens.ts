import { createHash, randomBytes } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import { ApiError } from './errors.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ISSUER = 'mathgo-api';
const AUDIENCE = 'mathgo';
const ALGORITHM = 'HS256';

export type SigningKey = Uint8Array;

export function signingKey(secret: string): SigningKey {
  return new TextEncoder().encode(secret);
}

export interface IssuedToken {
  readonly token: string;
  readonly expiresAt: Date;
}

/** A short-lived JWT naming the user. game-server checks it on join (S3-05). */
export async function signAccessToken(
  userId: string,
  key: SigningKey,
  now: Date,
): Promise<IssuedToken> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key);
  return { token, expiresAt: new Date(expiresAt * 1000) };
}

/** The user id in a valid access token; 401 `token-expired` or `invalid-token` otherwise. */
export async function verifyAccessToken(
  token: string,
  key: SigningKey,
  now: Date,
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    if (payload['typ'] !== 'access' || typeof payload.sub !== 'string') {
      throw new ApiError(401, 'invalid-token', 'Not an access token.');
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof errors.JWTExpired) {
      throw new ApiError(401, 'token-expired', 'The access token has expired; refresh it.');
    }
    throw new ApiError(401, 'invalid-token', 'The access token is not valid.');
  }
}

/** An opaque refresh token for the app, and the hash the database keeps instead of it. */
export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
