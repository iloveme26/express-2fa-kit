import { InMemoryRateLimiter } from "../../../src/ratelimit/memoryRateLimiter";

describe("InMemoryRateLimiter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows attempts up to maxAttempts", async () => {
    const limiter = new InMemoryRateLimiter({ maxAttempts: 3, windowMs: 60_000, lockoutMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      expect((await limiter.consume("key")).allowed).toBe(true);
    }
  });

  it("denies once maxAttempts is exceeded, with a retryAfterMs", async () => {
    const limiter = new InMemoryRateLimiter({ maxAttempts: 2, windowMs: 60_000, lockoutMs: 30_000 });
    await limiter.consume("key");
    await limiter.consume("key");
    const decision = await limiter.consume("key");
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterMs).toBe(30_000);
  });

  it("stays locked out until lockoutMs elapses", async () => {
    const limiter = new InMemoryRateLimiter({ maxAttempts: 1, windowMs: 60_000, lockoutMs: 10_000 });
    await limiter.consume("key");
    expect((await limiter.consume("key")).allowed).toBe(false);

    jest.advanceTimersByTime(9_999);
    expect((await limiter.consume("key")).allowed).toBe(false);

    jest.advanceTimersByTime(2);
    expect((await limiter.consume("key")).allowed).toBe(true);
  });

  it("resets a key's count/lockout", async () => {
    const limiter = new InMemoryRateLimiter({ maxAttempts: 1, windowMs: 60_000, lockoutMs: 60_000 });
    await limiter.consume("key");
    expect((await limiter.consume("key")).allowed).toBe(false);
    await limiter.reset("key");
    expect((await limiter.consume("key")).allowed).toBe(true);
  });

  it("tracks independent keys separately", async () => {
    const limiter = new InMemoryRateLimiter({ maxAttempts: 1, windowMs: 60_000, lockoutMs: 60_000 });
    await limiter.consume("a");
    expect((await limiter.consume("a")).allowed).toBe(false);
    expect((await limiter.consume("b")).allowed).toBe(true);
  });

  it("resets the window after windowMs elapses without hitting the limit", async () => {
    const limiter = new InMemoryRateLimiter({ maxAttempts: 2, windowMs: 5_000, lockoutMs: 60_000 });
    await limiter.consume("key");
    jest.advanceTimersByTime(5_001);
    // window reset — this is attempt 1 of a fresh window, not attempt 2 of the old one.
    expect((await limiter.consume("key")).allowed).toBe(true);
    expect((await limiter.consume("key")).allowed).toBe(true);
    expect((await limiter.consume("key")).allowed).toBe(false);
  });

  it("uses default options when none are provided", async () => {
    const limiter = new InMemoryRateLimiter();
    expect((await limiter.consume("key")).allowed).toBe(true);
  });
});
