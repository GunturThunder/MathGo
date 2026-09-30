import { randomInt } from 'node:crypto';
import { eq, refreshTokens, users, type Database } from '@mathgo/db';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ApiError } from './errors.js';
import {
  hashRefreshToken,
  newRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  signAccessToken,
  verifyAccessToken,
  type SigningKey,
} from './tokens.js';

export interface AuthDeps {
  readonly db: Database;
  readonly key: SigningKey;
  readonly now: () => Date;
}

interface Profile {
  id: string;
  nickname: string;
  birthYear: number;
  trophies: number;
}

const profileOf = ({ id, nickname, birthYear, trophies }: Profile): Profile => ({
  id,
  nickname,
  birthYear,
  trophies,
});

/** Access token + a fresh refresh token for a user, in the shape the app stores. */
async function issueSession(deps: AuthDeps, db: Database, user: Profile) {
  const now = deps.now();
  const access = await signAccessToken(user.id, deps.key, now);
  const refresh = newRefreshToken();
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refresh.hash,
    expiresAt: refreshExpiresAt,
  });
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken: refresh.token,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    user: profileOf(user),
  };
}

/** The signed-in user's id, from `Authorization: Bearer <access token>`. */
export async function authenticate(request: FastifyRequest, deps: AuthDeps): Promise<string> {
  const header = request.headers.authorization ?? '';
  const match = /^Bearer (\S+)$/.exec(header);
  if (match?.[1] === undefined) {
    throw new ApiError(401, 'invalid-token', 'Send the access token as a Bearer token.');
  }
  return verifyAccessToken(match[1], deps.key, deps.now());
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthDeps): void {
  app.post<{ Body: { birthYear: number } }>(
    '/auth/guest',
    {
      schema: {
        body: {
          type: 'object',
          required: ['birthYear'],
          additionalProperties: false,
          properties: { birthYear: { type: 'integer' } },
        },
      },
    },
    async (request, reply) => {
      const { birthYear } = request.body;
      const thisYear = deps.now().getUTCFullYear();
      if (birthYear < thisYear - 120 || birthYear > thisYear) {
        throw new ApiError(
          400,
          'invalid-birth-year',
          `Birth year must be ${thisYear - 120}–${thisYear}.`,
        );
      }
      const session = await deps.db.transaction(async (tx) => {
        // Placeholder until S3-03 lets the player pick a generated nickname.
        const [user] = await tx
          .insert(users)
          .values({ nickname: `Pemain ${randomInt(1000, 10_000)}`, birthYear })
          .returning();
        if (user === undefined) throw new Error('user insert returned nothing');
        return issueSession(deps, tx, user);
      });
      request.log.info({ userId: session.user.id }, 'guest created');
      return reply.status(201).send(session);
    },
  );

  app.post<{ Body: { refreshToken: string } }>(
    '/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          additionalProperties: false,
          properties: { refreshToken: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    async (request) => {
      const hash = hashRefreshToken(request.body.refreshToken);
      const now = deps.now();
      const outcome = await deps.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, hash))
          .for('update');
        if (row === undefined) return { kind: 'invalid' } as const;
        if (row.usedAt !== null) {
          // A used token came back: it was copied. End every session of this user.
          await tx.delete(refreshTokens).where(eq(refreshTokens.userId, row.userId));
          return { kind: 'reused', userId: row.userId } as const;
        }
        if (row.expiresAt <= now) return { kind: 'invalid' } as const;
        await tx.update(refreshTokens).set({ usedAt: now }).where(eq(refreshTokens.id, row.id));
        const [user] = await tx.select().from(users).where(eq(users.id, row.userId));
        if (user === undefined) return { kind: 'invalid' } as const;
        return { kind: 'ok', session: await issueSession(deps, tx, user) } as const;
      });
      if (outcome.kind === 'reused') {
        request.log.warn({ userId: outcome.userId }, 'refresh token reused; sessions revoked');
      }
      if (outcome.kind !== 'ok') {
        throw new ApiError(401, 'invalid-refresh-token', 'Sign in again.');
      }
      return outcome.session;
    },
  );

  app.get('/me', async (request) => {
    const userId = await authenticate(request, deps);
    const [user] = await deps.db.select().from(users).where(eq(users.id, userId));
    if (user === undefined) {
      throw new ApiError(401, 'invalid-token', 'This account no longer exists.');
    }
    return profileOf(user);
  });
}
