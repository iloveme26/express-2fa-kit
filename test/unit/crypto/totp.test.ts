import { generateTotp, verifyTotp } from "../../../src/crypto/totp";

// RFC 6238 Appendix B test vectors (8-digit codes, 30s step).
const seedSha1 = Buffer.from("12345678901234567890", "ascii");
const seedSha256 = Buffer.from("12345678901234567890123456789012", "ascii");
const seedSha512 = Buffer.from("1234567890123456789012345678901234567890123456789012345678901234", "ascii");

const sha1Vectors: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
];

const sha256Vectors: [number, string][] = [
  [59, "46119246"],
  [1111111109, "68084774"],
  [1111111111, "67062674"],
  [1234567890, "91819424"],
  [2000000000, "90698825"],
];

const sha512Vectors: [number, string][] = [
  [59, "90693936"],
  [1111111109, "25091201"],
  [1111111111, "99943326"],
  [1234567890, "93441116"],
  [2000000000, "38618901"],
];

describe("generateTotp (RFC 6238 vectors)", () => {
  it.each(sha1Vectors)("sha1 @ %i produces %s", (timeSec, expected) => {
    const code = generateTotp(seedSha1, { digits: 8, algorithm: "sha1", timestamp: timeSec * 1000 });
    expect(code).toBe(expected);
  });

  it.each(sha256Vectors)("sha256 @ %i produces %s", (timeSec, expected) => {
    const code = generateTotp(seedSha256, { digits: 8, algorithm: "sha256", timestamp: timeSec * 1000 });
    expect(code).toBe(expected);
  });

  it.each(sha512Vectors)("sha512 @ %i produces %s", (timeSec, expected) => {
    const code = generateTotp(seedSha512, { digits: 8, algorithm: "sha512", timestamp: timeSec * 1000 });
    expect(code).toBe(expected);
  });

  it("defaults to 6 digits and sha1", () => {
    const code = generateTotp(seedSha1, { timestamp: 59 * 1000 });
    expect(code).toHaveLength(6);
    expect(code).toBe("287082"); // last 6 digits of 94287082
  });
});

describe("verifyTotp", () => {
  it("accepts the current code", () => {
    const result = verifyTotp(seedSha1, "94287082", { digits: 8, timestamp: 59 * 1000 });
    expect(result).toEqual({ valid: true, matchedStep: 1 });
  });

  it("rejects a wrong code", () => {
    const result = verifyTotp(seedSha1, "00000000", { digits: 8, timestamp: 59 * 1000 });
    expect(result).toEqual({ valid: false });
  });

  it("rejects non-numeric tokens without throwing", () => {
    const result = verifyTotp(seedSha1, "abcdefgh", { digits: 8, timestamp: 59 * 1000 });
    expect(result).toEqual({ valid: false });
  });

  it("tolerates clock skew within the window", () => {
    // step 30 -> counter for t=59 is 1. Code for counter 2 corresponds to t=89.
    const codeForNextStep = generateTotp(seedSha1, { digits: 8, timestamp: 89 * 1000 });
    const result = verifyTotp(seedSha1, codeForNextStep, { digits: 8, timestamp: 59 * 1000, window: 1 });
    expect(result.valid).toBe(true);
    expect(result.matchedStep).toBe(2);
  });

  it("rejects drift outside the configured window", () => {
    const codeTwoStepsAhead = generateTotp(seedSha1, { digits: 8, timestamp: 119 * 1000 }); // counter 3
    const result = verifyTotp(seedSha1, codeTwoStepsAhead, { digits: 8, timestamp: 59 * 1000, window: 1 });
    expect(result.valid).toBe(false);
  });

  it("skips negative counters near epoch without throwing", () => {
    // counter for t=0 is 0; window=5 means counters -5..5 are considered, and negative
    // ones must be silently skipped rather than passed to generateHotp.
    expect(() => verifyTotp(seedSha1, "00000000", { digits: 8, timestamp: 0, window: 5 })).not.toThrow();
    expect(verifyTotp(seedSha1, "00000000", { digits: 8, timestamp: 0, window: 5 }).valid).toBe(false);
  });
});
