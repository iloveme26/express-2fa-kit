export interface RetryOptions {
  /** Additional attempts after the first. Default 3. */
  retries?: number;
  /** Base delay before the first retry, doubled each subsequent attempt. Default 200ms. */
  baseDelayMs?: number;
  /** Upper bound on the backoff delay. Default 2000ms. */
  maxDelayMs?: number;
  /** Return false to abort retrying immediately for a given error. Default: always retryable. */
  isRetryable?: (err: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `fn`, retrying with exponential backoff on failure. Rethrows the last error once exhausted. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const isRetryable = options.isRetryable ?? (() => true);

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryable(err)) {
        throw err;
      }
      await sleep(Math.min(baseDelayMs * 2 ** attempt, maxDelayMs));
    }
  }
}
