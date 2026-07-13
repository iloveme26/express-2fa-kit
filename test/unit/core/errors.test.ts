import {
  InvalidCodeError,
  InvalidDestinationError,
  NotEnrolledError,
  ProviderUnavailableError,
  RateLimitedError,
  TwoFactorError,
} from "../../../src/core/errors";

describe("TwoFactorError hierarchy", () => {
  it("NotEnrolledError has the right code and is a TwoFactorError", () => {
    const err = new NotEnrolledError();
    expect(err).toBeInstanceOf(TwoFactorError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("not_enrolled");
    expect(err.name).toBe("NotEnrolledError");
  });

  it("RateLimitedError carries retryAfterMs", () => {
    const err = new RateLimitedError(5000);
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfterMs).toBe(5000);
  });

  it("ProviderUnavailableError carries an optional cause", () => {
    const cause = new Error("network down");
    const err = new ProviderUnavailableError("delivery failed", cause);
    expect(err.code).toBe("provider_unavailable");
    expect(err.cause).toBe(cause);
  });

  it("InvalidDestinationError has the right code", () => {
    expect(new InvalidDestinationError().code).toBe("invalid_destination");
  });

  it("InvalidCodeError has the right code", () => {
    expect(new InvalidCodeError().code).toBe("invalid_code");
  });

  it("accepts custom messages", () => {
    expect(new NotEnrolledError("custom").message).toBe("custom");
  });
});
