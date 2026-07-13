import { RetryOptions } from "../channels/retry";
import { EmailChannel, SmsChannel } from "../channels/types";
import { TotpOptions } from "../crypto/totp";
import { RateLimiter } from "../ratelimit/types";
import { SecretStore } from "../storage/types";

export interface OtpMethodConfig {
  /** Number of digits in the generated code. Default 6. */
  digits?: number;
  /** Validity window in seconds. Default 600 (10 minutes). */
  ttlSeconds?: number;
  /** Verification attempts allowed before the challenge is exhausted. Default 5. */
  maxAttempts?: number;
}

export interface RateLimitConfig {
  /** Attempts allowed within `windowMs` before lockout. Default 5. */
  maxAttempts?: number;
  /** Rolling window length in ms. Default 60_000. */
  windowMs?: number;
  /** How long a key is locked out once `maxAttempts` is exceeded. Default 60_000. */
  lockoutMs?: number;
}

export interface TwoFactorManagerConfig {
  secretStore: SecretStore;
  /** Service name shown in authenticator apps and QR codes. */
  issuer: string;
  /** Default: a fresh InMemoryRateLimiter built from `rateLimit`. */
  rateLimiter?: RateLimiter;
  /** Required to enroll/send SMS codes. */
  smsChannel?: SmsChannel;
  /** Required to enroll/send email codes. */
  emailChannel?: EmailChannel;
  totp?: TotpOptions;
  sms?: OtpMethodConfig;
  email?: OtpMethodConfig;
  /** Ignored if `rateLimiter` is supplied directly. */
  rateLimit?: RateLimitConfig;
  /** Backoff for SMS/email delivery attempts. */
  retry?: RetryOptions;
}

export type VerifyReason = "invalid_code" | "expired" | "attempts_exhausted";

export interface VerifyOutcome {
  valid: boolean;
  /** Present when `valid` is false — TOTP failures always report "invalid_code". */
  reason?: VerifyReason;
}
