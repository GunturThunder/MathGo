import type { FastifyBaseLogger } from 'fastify';

// Sends parent consent codes (S5-05). The WhatsApp/SMS provider is chosen in S3-13 and goes live
// in S5-11; it plugs in here. Until then development uses `LogCodeSender`.

export type ConsentChannel = 'whatsapp' | 'sms';

export interface CodeMessage {
  readonly channel: ConsentChannel;
  /** E.164, e.g. `+6281234567890`. */
  readonly phone: string;
  readonly code: string;
}

export interface CodeSender {
  /** Resolves once the provider accepted the message; rejects if it couldn't be sent. */
  send(message: CodeMessage): Promise<void>;
}

/** Thrown by a sender that can't deliver on this channel (no WhatsApp on the number, outage). */
export class CodeNotSentError extends Error {
  constructor(readonly channel: ConsentChannel) {
    super(`The code could not be sent by ${channel}.`);
    this.name = 'CodeNotSentError';
  }
}

/**
 * Development only: writes the code to the api log instead of sending it, so a phone test can
 * read it there. The number is masked in the log. Refused in production (see config).
 */
export class LogCodeSender implements CodeSender {
  constructor(private readonly log: FastifyBaseLogger) {}

  send({ channel, phone, code }: CodeMessage): Promise<void> {
    this.log.warn(
      { channel, phone: `${phone.slice(0, 6)}…${phone.slice(-4)}`, code },
      'consent code (dev sender, not sent)',
    );
    return Promise.resolve();
  }
}

/**
 * WhatsApp first, SMS fallback (FR-20): a parent who asked for WhatsApp still gets the code if
 * WhatsApp fails. Returns the channel the code actually went by.
 */
export async function sendWithFallback(
  sender: CodeSender,
  message: CodeMessage,
): Promise<ConsentChannel> {
  try {
    await sender.send(message);
    return message.channel;
  } catch (error) {
    if (message.channel !== 'whatsapp') throw error;
    await sender.send({ ...message, channel: 'sms' });
    return 'sms';
  }
}
