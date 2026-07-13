import { createHmac } from "crypto";

export type HotpAlgorithm = "sha1" | "sha256" | "sha512";

export interface HotpOptions {
  /** Number of digits in the generated code. Default 6. */
  digits?: number;
  /** HMAC algorithm. Default "sha1" (required for Google Authenticator / Authy compatibility). */
  algorithm?: HotpAlgorithm;
}

/**
 * RFC 4226 HOTP: HMAC-based One-Time Password.
 * @param secret Raw secret key bytes (not base32-encoded).
 * @param counter Moving factor (8-byte big-endian counter for TOTP).
 */
export function generateHotp(secret: Buffer, counter: number | bigint, options: HotpOptions = {}): string {
  const digits = options.digits ?? 6;
  const algorithm = options.algorithm ?? "sha1";

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac(algorithm, secret).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binCode =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  const code = (binCode % 10 ** digits).toString().padStart(digits, "0");
  return code;
}
