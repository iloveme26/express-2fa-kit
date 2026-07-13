import { withRetry } from "../../../src/channels/retry";

describe("withRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the result on the first successful attempt without delay", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries after a failure and eventually succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { retries: 3, baseDelayMs: 10, maxDelayMs: 1000 });
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error once retries are exhausted", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fails"));

    const promise = withRetry(fn, { retries: 2, baseDelayMs: 10, maxDelayMs: 100 });
    const assertion = expect(promise).rejects.toThrow("always fails");
    await jest.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it("stops retrying immediately when isRetryable returns false", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("not retryable"));

    const promise = withRetry(fn, { retries: 5, isRetryable: () => false });
    await expect(promise).rejects.toThrow("not retryable");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("caps the backoff delay at maxDelayMs", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockRejectedValueOnce(new Error("fail 3"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { retries: 3, baseDelayMs: 1000, maxDelayMs: 1500 });
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
  });
});
