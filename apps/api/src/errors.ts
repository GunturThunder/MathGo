import type { FastifyError, FastifyInstance } from 'fastify';

/**
 * The one error format every endpoint returns. `code` is stable and kebab-case (the app maps it
 * to text in the player's language); `message` is for developers; `requestId` ties it to logs.
 */
export interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
  };
}

/** Throw from a route to send a specific status and code. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    const body: ErrorBody = {
      error: {
        code: 'not-found',
        message: `No route for ${request.method} ${request.url}`,
        requestId: request.id,
      },
    };
    return reply.status(404).send(body);
  });

  app.setErrorHandler((error: FastifyError | ApiError, request, reply) => {
    let status = 500;
    let code = 'internal-error';
    // Never send internal details to clients; they stay in the log.
    let message = 'Something went wrong.';

    if (error instanceof ApiError) {
      ({ statusCode: status, code, message } = error);
    } else if (error.validation !== undefined) {
      status = 400;
      code = 'invalid-request';
      message = error.message;
    } else if (
      error.statusCode !== undefined &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      // Fastify's own client errors, e.g. a malformed JSON body.
      status = error.statusCode;
      code = 'bad-request';
      message = error.message;
    }

    if (status >= 500) {
      request.log.error({ err: error }, 'request failed');
    } else {
      request.log.info({ code, status }, 'request rejected');
    }
    const body: ErrorBody = { error: { code, message, requestId: request.id } };
    return reply.status(status).send(body);
  });
}
