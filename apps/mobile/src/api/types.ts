/** What `POST /auth/guest` and `POST /auth/refresh` return (apps/api). */
export interface Session {
  readonly accessToken: string;
  /** ISO time. */
  readonly accessTokenExpiresAt: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
  readonly user: Profile;
}

export interface Profile {
  readonly id: string;
  readonly nickname: string;
  readonly birthYear: number;
  readonly trophies: number;
  /** May play online: an adult, or a minor with parent consent. */
  readonly online: boolean;
}

/** What `POST /consent/start` returns (S5-05): a code is on its way to the parent's email. */
export interface ConsentStarted {
  readonly consentId: string;
  /** Masked, e.g. `ay•••••••@gmail.com`. */
  readonly email: string;
  /** ISO times: the code stops working, and "resend" opens. */
  readonly expiresAt: string;
  readonly resendAt: string;
}

/** The api's one error format. Some errors add facts, e.g. `attemptsLeft` or `retryAt`. */
export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly attemptsLeft?: number;
    readonly retryAt?: string;
  };
}
