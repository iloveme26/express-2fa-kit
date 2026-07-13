export interface RateLimitDecision {
  allowed: boolean;
  /** Present when `allowed` is false: how long the caller should wait before retrying. */
  retryAfterMs?: number;
}

/**
 * Pluggable rate limiter. `core/manager.ts` builds keys (e.g. `verify:{userId}:{method}`,
 * `verify-ip:{ip}:{method}`, `send:{userId}:{method}`) — implementations are just dumb
 * string-keyed counters and don't need to know what a key represents.
 */
export interface RateLimiter {
  consume(key: string): Promise<RateLimitDecision>;
  reset(key: string): Promise<void>;
}
