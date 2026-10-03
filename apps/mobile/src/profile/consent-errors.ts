import type { TFunction } from 'i18next';
import { ApiError } from '../api';
import { formatClock } from '../battle/battle-view';

/** How long until `retryAt` (an ISO time the server sent), as m:ss. */
export function untilText(retryAt: string | undefined, now: number): string {
  return formatClock(retryAt === undefined ? 0 : Date.parse(retryAt) - now);
}

/** Why asking for a code failed (POST /consent/start, S5-05), in the player's language. */
export function startErrorText(error: unknown, now: number, t: TFunction): string {
  if (!(error instanceof ApiError)) return t('parent.offline');
  const time = untilText(error.details.retryAt, now);
  switch (error.code) {
    case 'invalid-email':
      return t('parent.invalidEmail');
    case 'resend-too-soon':
      return t('parent.waitFor', { time });
    case 'too-many-codes':
      return t('parent.tooManyCodes', { time });
    case 'code-locked':
      return t('parent.blockedText', { time });
    case 'consent-unavailable':
      return t('parent.unavailable');
    default:
      return t('parent.offline');
  }
}
