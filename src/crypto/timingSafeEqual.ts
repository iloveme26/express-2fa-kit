import { createHash, timingSafeEqual as nodeTimingSafeEqual } from "crypto";

/**
 * Constant-time string comparison. Node's crypto.timingSafeEqual throws if
 * buffer lengths differ, which itself leaks length via exception timing/path,
 * so both inputs are first hashed to a fixed-length digest before comparison.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return nodeTimingSafeEqual(digestA, digestB);
}
