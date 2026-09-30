/**
 * At most `max` events per `windowMs` for each key (a sliding window). Answers beyond it are
 * dropped: nobody types more than a few answers a second, so a flood means a script.
 */
export class RateLimiter<K> {
  private readonly times = new Map<K, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Records the event and returns whether it is allowed. */
  allow(key: K, now: number): boolean {
    const recent = (this.times.get(key) ?? []).filter((t) => t > now - this.windowMs);
    if (recent.length >= this.max) {
      this.times.set(key, recent);
      return false;
    }
    recent.push(now);
    this.times.set(key, recent);
    return true;
  }
}
