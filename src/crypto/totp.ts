import { generateHotp, HotpAlgorithm } from "./hotp";
import { timingSafeEqual } from "./timingSafeEqual";

export interface TotpOptions {
  /** Number of digits in the generated code. Default 6. */
  digits?: number;
  /** HMAC algorithm. Default "sha1" (required for Google Authenticator / Authy compatibility). */
  algorithm?: HotpAlgorithm;
  /** Time step in seconds. Default 30. */
  step?: number;
  /** Number of steps tolerated on either side of "now", to absorb clock skew. Default 1 (i.e. +/-30s). */
  window?: number;
  /** Reference time in ms since epoch. Defaults to Date.now(); override in tests or to check a specific instant. */
  timestamp?: number;
}

export interface TotpVerifyResult {
  valid: boolean;
  /**
   * The time-step counter that matched, when valid. Callers should persist this
   * (e.g. in SecretStore) and reject any future verification with a matchedStep
   * <= the last accepted one, to prevent replay of a captured code within its window.
   */
  matchedStep?: number;
}

function counterForTimestamp(timestampMs: number, stepSeconds: number): number {
  return Math.floor(timestampMs / 1000 / stepSeconds);
}

export function generateTotp(secret: Buffer, options: TotpOptions = {}): string {
  const step = options.step ?? 30;
  const timestamp = options.timestamp ?? Date.now();
  const counter = counterForTimestamp(timestamp, step);
  return generateHotp(secret, counter, options);
}

/**
 * Verifies a TOTP token against a window of adjacent time steps to tolerate clock skew.
 * Does NOT enforce replay protection by itself — pass `matchedStep` back to the caller's
 * SecretStore and reject steps <= the last accepted step for a given user/method.
 */
export function verifyTotp(secret: Buffer, token: string, options: TotpOptions = {}): TotpVerifyResult {
  const step = options.step ?? 30;
  const window = options.window ?? 1;
  const timestamp = options.timestamp ?? Date.now();
  const currentCounter = counterForTimestamp(timestamp, step);

  if (!/^\d+$/.test(token)) {
    return { valid: false };
  }

  for (let drift = -window; drift <= window; drift++) {
    const counter = currentCounter + drift;
    if (counter < 0) continue;
    const candidate = generateHotp(secret, counter, options);
    if (timingSafeEqual(candidate, token)) {
      return { valid: true, matchedStep: counter };
    }
  }

  return { valid: false };
}
