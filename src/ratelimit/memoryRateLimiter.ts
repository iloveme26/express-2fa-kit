import { RateLimitDecision, RateLimiter } from "./types";

export interface InMemoryRateLimiterOptions {
  /** Attempts allowed within `windowMs` before lockout. Default 5. */
  maxAttempts?: number;
  /** Rolling window length in ms. Default 60_000 (1 minute). */
  windowMs?: number;
  /** How long a key is locked out once `maxAttempts` is exceeded. Default 60_000 (1 minute). */
  lockoutMs?: number;
}

interface Bucket {
  count: number;
  windowStart: number;
  lockedUntil?: number;
}

/**
 * Fixed-window rate limiter with lockout, backed by an in-process Map.
 * Suitable for development, tests, and single-process deployments only —
 * not shared across processes/instances.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: InMemoryRateLimiterOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.windowMs = options.windowMs ?? 60_000;
    this.lockoutMs = options.lockoutMs ?? 60_000;
  }

  async consume(key: string): Promise<RateLimitDecision> {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (bucket?.lockedUntil !== undefined) {
      if (now < bucket.lockedUntil) {
        return { allowed: false, retryAfterMs: bucket.lockedUntil - now };
      }
      bucket = undefined;
    }

    if (!bucket || now - bucket.windowStart >= this.windowMs) {
      bucket = { count: 0, windowStart: now };
    }

    bucket.count += 1;

    if (bucket.count > this.maxAttempts) {
      bucket.lockedUntil = now + this.lockoutMs;
      this.buckets.set(key, bucket);
      return { allowed: false, retryAfterMs: this.lockoutMs };
    }

    this.buckets.set(key, bucket);
    return { allowed: true };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}
