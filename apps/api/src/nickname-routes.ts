import { eq, users } from '@mathgo/db';
import type { FastifyInstance } from 'fastify';
import { authenticate, profileOf, type AuthDeps } from './auth.js';
import { ApiError } from './errors.js';
import {
  generateNicknames,
  isGeneratedNickname,
  NICKNAME_LANGUAGES,
  type NicknameLanguage,
} from './nicknames.js';

/** Choices shown on the nickname screen (S3-08). */
export const NICKNAME_CHOICES = 5;

export function registerNicknameRoutes(app: FastifyInstance, deps: AuthDeps): void {
  app.get<{ Querystring: { lang?: NicknameLanguage } }>(
    '/nicknames',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { lang: { type: 'string', enum: [...NICKNAME_LANGUAGES] } },
        },
      },
    },
    async (request) => ({
      nicknames: generateNicknames(request.query.lang ?? 'id', NICKNAME_CHOICES),
    }),
  );

  app.patch<{ Body: { nickname: string } }>(
    '/me/nickname',
    {
      schema: {
        body: {
          type: 'object',
          required: ['nickname'],
          additionalProperties: false,
          properties: { nickname: { type: 'string', maxLength: 60 } },
        },
      },
    },
    async (request) => {
      const { userId } = await authenticate(request, deps);
      const { nickname } = request.body;
      // No typed names (PRD: privacy and safety): only names the generator can produce.
      if (!isGeneratedNickname(nickname)) {
        throw new ApiError(400, 'nickname-not-allowed', 'Pick one of the offered nicknames.');
      }
      const [user] = await deps.db
        .update(users)
        .set({ nickname })
        .where(eq(users.id, userId))
        .returning();
      if (user === undefined) {
        throw new ApiError(401, 'invalid-token', 'This account no longer exists.');
      }
      return profileOf(user);
    },
  );
}
