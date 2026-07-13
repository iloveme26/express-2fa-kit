import { randomBytes } from "crypto";
import { toDataURL } from "qrcode";
import { base32Encode } from "../crypto/base32";
import { HotpAlgorithm } from "../crypto/hotp";
import { TotpOptions, TotpVerifyResult, verifyTotp } from "../crypto/totp";

/** Generates raw TOTP secret bytes (not base32-encoded). Default 20 bytes (160 bits). */
export function generateTotpSecret(byteLength = 20): Buffer {
  return randomBytes(byteLength);
}

export interface BuildOtpauthUriParams {
  secret: Buffer;
  /** Identifies the account to the authenticator app, e.g. a username or email. */
  accountName: string;
  /** Identifies the service to the authenticator app, e.g. your app's name. */
  issuer: string;
  algorithm?: HotpAlgorithm;
  digits?: number;
  step?: number;
}

/** Builds an otpauth:// provisioning URI per the Key Uri Format used by authenticator apps. */
export function buildOtpauthUri(params: BuildOtpauthUriParams): string {
  const algorithm = params.algorithm ?? "sha1";
  const digits = params.digits ?? 6;
  const step = params.step ?? 30;
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.accountName)}`;
  const query = new URLSearchParams({
    secret: base32Encode(params.secret),
    issuer: params.issuer,
    algorithm: algorithm.toUpperCase(),
    digits: String(digits),
    period: String(step),
  });

  return `otpauth://totp/${label}?${query.toString()}`;
}

/** Renders an otpauth:// URI as a scannable QR code data URL (`data:image/png;base64,...`). */
export function generateTotpQrCode(otpauthUrl: string): Promise<string> {
  return toDataURL(otpauthUrl);
}

export interface VerifyTotpCodeOptions extends TotpOptions {
  /** Highest previously-accepted time-step counter; matches at or below this are rejected as replays. */
  lastAcceptedCounter?: number;
}

/**
 * Wraps crypto/totp.ts's verifyTotp with the replay-protection its own comments call for:
 * a match is only accepted if its counter is strictly greater than the last accepted one.
 */
export function verifyTotpCode(secret: Buffer, code: string, options: VerifyTotpCodeOptions = {}): TotpVerifyResult {
  const result = verifyTotp(secret, code, options);
  if (!result.valid || result.matchedStep === undefined) {
    return { valid: false };
  }
  if (options.lastAcceptedCounter !== undefined && result.matchedStep <= options.lastAcceptedCounter) {
    return { valid: false };
  }
  return result;
}
