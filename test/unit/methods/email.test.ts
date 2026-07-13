import { createEmailChallenge, verifyEmailCode } from "../../../src/methods/email";

describe("email method", () => {
  it("creates a challenge with defaults", () => {
    const challenge = createEmailChallenge();
    expect(challenge.code).toHaveLength(6);
    expect(challenge.maxAttempts).toBe(5);
  });

  it("verifies a correct code", () => {
    const now = new Date();
    const challenge = createEmailChallenge({ now });
    const result = verifyEmailCode(challenge, challenge.code, 1, now);
    expect(result.valid).toBe(true);
  });

  it("rejects a wrong code", () => {
    const now = new Date();
    const challenge = createEmailChallenge({ now });
    const wrong = challenge.code === "000000" ? "111111" : "000000";
    const result = verifyEmailCode(challenge, wrong, 1, now);
    expect(result).toEqual({ valid: false, reason: "invalid_code" });
  });
});
