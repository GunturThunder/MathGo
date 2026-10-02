/**
 * The server's rule (`isAdult` in @mathgo/auth), mirrored for routing only: the server still
 * decides. Only the birth year is known, so a player counts as an adult from the year they turn
 * 19, the first year they are certainly 18 (PP Tunas). @mathgo/auth isn't bundled in the app
 * (it carries the JWT library), hence the copy; age.test.ts pins the boundary.
 */
export function isAdult(birthYear: number, now: Date): boolean {
  return now.getUTCFullYear() - birthYear >= 19;
}

/** Years shown on the picker: the newest is this year minus 4 (players are 5 or older). */
export const NEWEST_BIRTH_YEAR_OFFSET = 4;
export const OLDEST_BIRTH_YEAR = 1920;
