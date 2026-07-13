import {
  InvalidDestinationError,
  NotEnrolledError,
  ProviderUnavailableError,
  RateLimitedError,
  TwoFactorError,
} from "../core/errors";

export interface MappedError {
  status: number;
  body: { error: string; retryAfterMs?: number };
}

/** Maps a TwoFactorManager error to an HTTP status/body. Used by the built-in handler factories. */
export function mapErrorToStatus(err: unknown): MappedError {
  if (err instanceof RateLimitedError) {
    return { status: 429, body: { error: err.code, retryAfterMs: err.retryAfterMs } };
  }
  if (err instanceof NotEnrolledError || err instanceof InvalidDestinationError) {
    return { status: 400, body: { error: err.code } };
  }
  if (err instanceof ProviderUnavailableError) {
    return { status: 503, body: { error: err.code } };
  }
  if (err instanceof TwoFactorError) {
    return { status: 400, body: { error: err.code } };
  }
  return { status: 500, body: { error: "internal_error" } };
}
