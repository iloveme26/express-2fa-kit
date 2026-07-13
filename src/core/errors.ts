/** Base class for all errors thrown by TwoFactorManager. */
export class TwoFactorError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** Thrown when an operation targets a method the user hasn't (successfully) enrolled in. */
export class NotEnrolledError extends TwoFactorError {
  constructor(message = "User is not enrolled in this 2FA method.") {
    super(message, "not_enrolled");
  }
}

/** Thrown when a caller has exceeded the configured attempt/send rate for a key. */
export class RateLimitedError extends TwoFactorError {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, message = "Too many attempts. Please try again later.") {
    super(message, "rate_limited");
    this.retryAfterMs = retryAfterMs;
  }
}

/** Thrown when an SMS/email channel is missing or fails delivery after retries are exhausted. */
export class ProviderUnavailableError extends TwoFactorError {
  readonly cause?: unknown;

  constructor(message = "Delivery provider is unavailable.", cause?: unknown) {
    super(message, "provider_unavailable");
    this.cause = cause;
  }
}

/** Thrown when an enrollment destination (phone number/email address) fails basic validation. */
export class InvalidDestinationError extends TwoFactorError {
  constructor(message = "Invalid destination for this method.") {
    super(message, "invalid_destination");
  }
}

/** Reserved for HTTP-layer error mapping; never thrown by TwoFactorManager itself — a wrong
 *  code is a normal outcome (`{ valid: false }`) from `verify()`, not an exception. */
export class InvalidCodeError extends TwoFactorError {
  constructor(message = "Invalid code.") {
    super(message, "invalid_code");
  }
}
