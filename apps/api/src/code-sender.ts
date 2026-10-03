import type { FastifyBaseLogger } from 'fastify';

// Sends parent consent codes by email (S5-05; decided Oct 3, 2026: free, no sender
// registration). The email provider is chosen in S3-13 and goes live in S5-11; it plugs in here.
// Until then development uses `LogCodeSender`.

export interface CodeMessage {
  /** Normalized, e.g. `ayah.budi@gmail.com`. */
  readonly email: string;
  readonly code: string;
}

export interface CodeSender {
  /** Resolves once the provider accepted the email; rejects if it couldn't be sent. */
  send(message: CodeMessage): Promise<void>;
}

/**
 * Development only: writes the code to the api log instead of sending it, so a phone test can
 * read it there. The address is masked in the log. Refused in production (see config).
 */
export class LogCodeSender implements CodeSender {
  constructor(
    private readonly log: FastifyBaseLogger,
    private readonly mask: (email: string) => string,
  ) {}

  send({ email, code }: CodeMessage): Promise<void> {
    this.log.warn({ email: this.mask(email), code }, 'consent code (dev sender, not sent)');
    return Promise.resolve();
  }
}
