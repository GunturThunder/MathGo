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

/** The api's one error format. */
export interface ApiErrorBody {
  readonly error: { readonly code: string; readonly message: string; readonly requestId: string };
}
