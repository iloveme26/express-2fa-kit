import {
  createOtpChallenge,
  generateNumericCode,
  hashCode,
  isExpired,
  verifyOtpChallenge,
} from "../../../src/methods/otpCode";

describe("generateNumericCode", () => {
  it("produces a code of the requested length, zero-padded", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateNumericCode(6);
      expect(code).toHaveLength(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    }
  });

  it("supports other digit counts", () => {
    expect(generateNumericCode(4)).toHaveLength(4);
    expect(generateNumericCode(8)).toHaveLength(8);
  });
});

describe("hashCode", () => {
  it("is deterministic", () => {
    expect(hashCode("123456")).toBe(hashCode("123456"));
  });

  it("differs for different inputs", () => {
    expect(hashCode("123456")).not.toBe(hashCode("654321"));
  });

  it("never returns the plaintext code", () => {
    expect(hashCode("123456")).not.toBe("123456");
  });
});

describe("isExpired", () => {
  it("is false before expiry and true at/after it", () => {
    const expiresAt = new Date("2026-01-01T00:00:00.000Z");
    expect(isExpired(expiresAt, new Date("2025-12-31T23:59:59.999Z"))).toBe(false);
    expect(isExpired(expiresAt, expiresAt)).toBe(true);
    expect(isExpired(expiresAt, new Date("2026-01-01T00:00:00.001Z"))).toBe(true);
  });
});

describe("createOtpChallenge", () => {
  it("applies defaults", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const challenge = createOtpChallenge({ now });
    expect(challenge.code).toHaveLength(6);
    expect(challenge.maxAttempts).toBe(5);
    expect(challenge.expiresAt.getTime()).toBe(now.getTime() + 600_000);
    expect(challenge.codeHash).toBe(hashCode(challenge.code));
  });

  it("honors custom digits/ttl/maxAttempts", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const challenge = createOtpChallenge({ digits: 8, ttlSeconds: 60, maxAttempts: 3, now });
    expect(challenge.code).toHaveLength(8);
    expect(challenge.maxAttempts).toBe(3);
    expect(challenge.expiresAt.getTime()).toBe(now.getTime() + 60_000);
  });
});

describe("verifyOtpChallenge", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const challenge = createOtpChallenge({ now, ttlSeconds: 600, maxAttempts: 3 });

  it("accepts the correct code within the window and attempt budget", () => {
    const result = verifyOtpChallenge(challenge, challenge.code, 1, now);
    expect(result).toEqual({ valid: true });
  });

  it("rejects an incorrect code", () => {
    const wrong = challenge.code === "000000" ? "111111" : "000000";
    const result = verifyOtpChallenge(challenge, wrong, 1, now);
    expect(result).toEqual({ valid: false, reason: "invalid_code" });
  });

  it("rejects an expired challenge even with the correct code", () => {
    const afterExpiry = new Date(challenge.expiresAt.getTime() + 1);
    const result = verifyOtpChallenge(challenge, challenge.code, 1, afterExpiry);
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects once attempts exceed maxAttempts", () => {
    const result = verifyOtpChallenge(challenge, challenge.code, 4, now);
    expect(result).toEqual({ valid: false, reason: "attempts_exhausted" });
  });

  it("checks attempts_exhausted before expiry", () => {
    const afterExpiry = new Date(challenge.expiresAt.getTime() + 1);
    const result = verifyOtpChallenge(challenge, challenge.code, 4, afterExpiry);
    expect(result.reason).toBe("attempts_exhausted");
  });
});
