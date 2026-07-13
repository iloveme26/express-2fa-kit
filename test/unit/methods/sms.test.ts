import { createSmsChallenge, verifySmsCode } from "../../../src/methods/sms";

describe("sms method", () => {
  it("creates a challenge with defaults", () => {
    const challenge = createSmsChallenge();
    expect(challenge.code).toHaveLength(6);
    expect(challenge.maxAttempts).toBe(5);
  });

  it("verifies a correct code", () => {
    const now = new Date();
    const challenge = createSmsChallenge({ now });
    const result = verifySmsCode(challenge, challenge.code, 1, now);
    expect(result.valid).toBe(true);
  });

  it("rejects a wrong code", () => {
    const now = new Date();
    const challenge = createSmsChallenge({ now });
    const wrong = challenge.code === "000000" ? "111111" : "000000";
    const result = verifySmsCode(challenge, wrong, 1, now);
    expect(result).toEqual({ valid: false, reason: "invalid_code" });
  });
});
