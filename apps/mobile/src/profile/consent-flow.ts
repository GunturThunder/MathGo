import type { ConsentStarted } from '../api';

// The parent consent screens (S5-09) share where the flow stands: the address the code went to,
// to resend it, and what the server said. Kept in memory only: the address is never saved.

export interface ConsentFlow {
  readonly email: string;
  readonly started: ConsentStarted;
}

let current: ConsentFlow | null = null;

export const consentFlow = {
  get: (): ConsentFlow | null => current,
  set: (flow: ConsentFlow): void => {
    current = flow;
  },
  clear: (): void => {
    current = null;
  },
};
