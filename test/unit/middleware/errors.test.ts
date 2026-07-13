import {
  InvalidDestinationError,
  NotEnrolledError,
  ProviderUnavailableError,
  RateLimitedError,
} from "../../../src/core/errors";
import { mapErrorToStatus } from "../../../src/middleware/errors";

describe("mapErrorToStatus", () => {
  it("maps RateLimitedError to 429 with retryAfterMs", () => {
    const mapped = mapErrorToStatus(new RateLimitedError(1234));
    expect(mapped.status).toBe(429);
    expect(mapped.body).toEqual({ error: "rate_limited", retryAfterMs: 1234 });
  });

  it("maps NotEnrolledError to 400", () => {
    const mapped = mapErrorToStatus(new NotEnrolledError());
    expect(mapped.status).toBe(400);
    expect(mapped.body.error).toBe("not_enrolled");
  });

  it("maps InvalidDestinationError to 400", () => {
    const mapped = mapErrorToStatus(new InvalidDestinationError());
    expect(mapped.status).toBe(400);
    expect(mapped.body.error).toBe("invalid_destination");
  });

  it("maps ProviderUnavailableError to 503", () => {
    const mapped = mapErrorToStatus(new ProviderUnavailableError());
    expect(mapped.status).toBe(503);
    expect(mapped.body.error).toBe("provider_unavailable");
  });

  it("maps an unknown error to 500", () => {
    const mapped = mapErrorToStatus(new Error("boom"));
    expect(mapped.status).toBe(500);
    expect(mapped.body).toEqual({ error: "internal_error" });
  });

  it("maps a non-Error thrown value to 500", () => {
    const mapped = mapErrorToStatus("just a string");
    expect(mapped.status).toBe(500);
  });
});
