import { createHash, randomInt } from "crypto";
import { timingSafeEqual } from "../crypto/timingSafeEqual";

export function generateNumericCode(digits: number): string {
  const max = 10 ** digits;
  return randomInt(0, max).toString().padStart(digits, "0");
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export type OtpVerifyReason = "invalid_code" | "expired" | "attempts_exhausted";

export interface OtpVerifyResult {
  valid: boolean;
  reason?: OtpVerifyReason;
}

export interface OtpChallengeInput {
  codeHash: string;
  expiresAt: Date;
  maxAttempts: number;
}

export interface CreateOtpChallengeParams {
  /** Number of digits in the generated code. Default 6. */
  digits?: number;
  /** Validity window in seconds. Default 600 (10 minutes). */
  ttlSeconds?: number;
  /** Verification attempts allowed before the challenge is exhausted. Default 5. */
  maxAttempts?: number;
  now?: Date;
}

export interface CreatedOtpChallenge {
  /** Plaintext code — hand this to a delivery channel, never persist it. */
  code: string;
  codeHash: string;
  expiresAt: Date;
  maxAttempts: number;
}

export function createOtpChallenge(params: CreateOtpChallengeParams = {}): CreatedOtpChallenge {
  const digits = params.digits ?? 6;
  const ttlSeconds = params.ttlSeconds ?? 600;
  const maxAttempts = params.maxAttempts ?? 5;
  const now = params.now ?? new Date();
  const code = generateNumericCode(digits);

  return {
    code,
    codeHash: hashCode(code),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    maxAttempts,
  };
}

/**
 * Checks a submitted code against a persisted challenge. `attempts` must already reflect
 * this attempt (the caller increments it durably via SecretStore before calling this),
 * so attempt-limit enforcement can't be bypassed by concurrent requests racing a
 * read-then-check.
 */
export function verifyOtpChallenge(
  challenge: OtpChallengeInput,
  code: string,
  attempts: number,
  now: Date = new Date()
): OtpVerifyResult {
  if (attempts > challenge.maxAttempts) {
    return { valid: false, reason: "attempts_exhausted" };
  }
  if (isExpired(challenge.expiresAt, now)) {
    return { valid: false, reason: "expired" };
  }
  if (!timingSafeEqual(hashCode(code), challenge.codeHash)) {
    return { valid: false, reason: "invalid_code" };
  }
  return { valid: true };
}
