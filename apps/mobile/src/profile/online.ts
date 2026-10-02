import { api } from '../api';
import { isAdult } from './age';
import { profile } from './store';

/**
 * Under-18 mode (S3-09, FR-20): a player under 18 practises vs the bot only until a parent
 * unlocks online play. Minors get no account before that (the server refuses), so "under 18 and
 * no session" means online play is still locked; after consent (S5-05, S5-09) they have one.
 */
export function onlineLocked(now: Date = new Date()): boolean {
  const { birthYear } = profile.get();
  return birthYear !== null && !isAdult(birthYear, now) && api.session === null;
}

/** Thrown before any connection is opened when online play is locked. */
export class OnlineLockedError extends Error {
  constructor() {
    super('Online play needs a parent’s consent first.');
    this.name = 'OnlineLockedError';
  }
}
