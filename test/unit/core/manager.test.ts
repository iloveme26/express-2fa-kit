import { base32Decode } from "../../../src/crypto/base32";
import { generateTotp } from "../../../src/crypto/totp";
import {
  InvalidDestinationError,
  NotEnrolledError,
  ProviderUnavailableError,
  RateLimitedError,
} from "../../../src/core/errors";
import { TwoFactorManager } from "../../../src/core/manager";
import { InMemoryRateLimiter } from "../../../src/ratelimit/memoryRateLimiter";
import { InMemorySecretStore } from "../../../src/storage/memoryStore";

function extractSecret(otpauthUrl: string): Buffer {
  const query = new URLSearchParams(otpauthUrl.split("?")[1]);
  return base32Decode(query.get("secret") as string);
}

function generousRateLimiter(): InMemoryRateLimiter {
  return new InMemoryRateLimiter({ maxAttempts: 1000, windowMs: 60_000, lockoutMs: 60_000 });
}

function createTestManager(overrides: Partial<{ rateLimiter: InMemoryRateLimiter }> = {}) {
  const secretStore = new InMemorySecretStore();
  const smsChannel = { sendSms: jest.fn().mockResolvedValue(undefined) };
  const emailChannel = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const manager = new TwoFactorManager({
    secretStore,
    issuer: "Acme",
    rateLimiter: overrides.rateLimiter ?? generousRateLimiter(),
    smsChannel,
    emailChannel,
    retry: { retries: 0 },
  });
  return { manager, secretStore, smsChannel, emailChannel };
}

describe("TwoFactorManager: TOTP enrollment", () => {
  it("enrollTotp returns a QR code and otpauth URL, stored as unconfirmed", async () => {
    const { manager, secretStore } = createTestManager();
    const { otpauthUrl, qrCodeDataUrl } = await manager.enrollTotp("user-1", "user-1@example.com");

    expect(otpauthUrl).toContain("otpauth://totp/");
    expect(qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);

    const record = await secretStore.getEnrollment("user-1", "totp");
    expect(record?.enabled).toBe(false);
    expect(record?.secret).toBeInstanceOf(Buffer);
  });

  it("confirmTotpEnrollment activates enrollment on a correct code", async () => {
    const { manager, secretStore } = createTestManager();
    const { otpauthUrl } = await manager.enrollTotp("user-1", "user-1@example.com");
    const secret = extractSecret(otpauthUrl);
    const code = generateTotp(secret);

    const result = await manager.confirmTotpEnrollment("user-1", code);
    expect(result.valid).toBe(true);

    const record = await secretStore.getEnrollment("user-1", "totp");
    expect(record?.enabled).toBe(true);
    expect(await manager.isEnabled("user-1", "totp")).toBe(true);
  });

  it("confirmTotpEnrollment returns invalid for a wrong code and leaves enrollment unconfirmed", async () => {
    const { manager } = createTestManager();
    await manager.enrollTotp("user-1", "user-1@example.com");
    const result = await manager.confirmTotpEnrollment("user-1", "000000");
    expect(result.valid).toBe(false);
    expect(await manager.isEnabled("user-1", "totp")).toBe(false);
  });

  it("confirmTotpEnrollment throws NotEnrolledError with no enrollment at all", async () => {
    const { manager } = createTestManager();
    await expect(manager.confirmTotpEnrollment("nobody", "123456")).rejects.toThrow(NotEnrolledError);
  });

  it("enrollTotp overwrites a prior draft (starts a fresh secret)", async () => {
    const { manager } = createTestManager();
    const first = await manager.enrollTotp("user-1", "user-1@example.com");
    const second = await manager.enrollTotp("user-1", "user-1@example.com");
    expect(first.otpauthUrl).not.toBe(second.otpauthUrl);

    // the first secret is no longer valid
    const firstSecret = extractSecret(first.otpauthUrl);
    const codeForFirst = generateTotp(firstSecret);
    const result = await manager.confirmTotpEnrollment("user-1", codeForFirst);
    expect(result.valid).toBe(false);
  });
});

describe("TwoFactorManager: TOTP verify + replay protection", () => {
  it("verify() accepts a valid code once TOTP is confirmed", async () => {
    const { manager } = createTestManager();
    const { otpauthUrl } = await manager.enrollTotp("user-1", "u@example.com");
    const secret = extractSecret(otpauthUrl);
    const code = generateTotp(secret);
    await manager.confirmTotpEnrollment("user-1", code);

    const nextCode = generateTotp(secret, { timestamp: Date.now() + 30_000 });
    const outcome = await manager.verify("user-1", "totp", nextCode);
    expect(outcome.valid).toBe(true);
  });

  it("verify() rejects replaying the same code twice", async () => {
    const { manager } = createTestManager();
    const { otpauthUrl } = await manager.enrollTotp("user-1", "u@example.com");
    const secret = extractSecret(otpauthUrl);
    const timestamp = Date.now();
    const code = generateTotp(secret, { timestamp });
    await manager.confirmTotpEnrollment("user-1", code);

    // confirmTotpEnrollment already consumed `code` as the accepted counter; replaying it must fail.
    const replay = await manager.verify("user-1", "totp", code, {});
    expect(replay.valid).toBe(false);
    expect(replay.reason).toBe("invalid_code");
  });

  it("verify() throws NotEnrolledError for TOTP that was never confirmed", async () => {
    const { manager } = createTestManager();
    await manager.enrollTotp("user-1", "u@example.com");
    await expect(manager.verify("user-1", "totp", "123456")).rejects.toThrow(NotEnrolledError);
  });

  it("verify() throws NotEnrolledError when there is no enrollment at all", async () => {
    const { manager } = createTestManager();
    await expect(manager.verify("nobody", "totp", "123456")).rejects.toThrow(NotEnrolledError);
  });
});

describe("TwoFactorManager: SMS enrollment, challenge, verify", () => {
  it("rejects enrolling an empty phone number", async () => {
    const { manager } = createTestManager();
    await expect(manager.enrollSms("user-1", "")).rejects.toThrow(InvalidDestinationError);
  });

  it("sendChallenge delivers a code via the configured SmsChannel", async () => {
    const { manager, smsChannel } = createTestManager();
    await manager.enrollSms("user-1", "+15551234567");
    const result = await manager.sendChallenge("user-1", "sms");

    expect(result.sent).toBe(true);
    expect(smsChannel.sendSms).toHaveBeenCalledTimes(1);
    expect(smsChannel.sendSms.mock.calls[0][0]).toMatchObject({ to: "+15551234567" });
  });

  it("sendChallenge throws NotEnrolledError if the phone number was never registered", async () => {
    const { manager } = createTestManager();
    await expect(manager.sendChallenge("user-1", "sms")).rejects.toThrow(NotEnrolledError);
  });

  it("verify() with the correct code succeeds and activates the enrollment", async () => {
    const { manager, smsChannel } = createTestManager();
    await manager.enrollSms("user-1", "+15551234567");
    await manager.sendChallenge("user-1", "sms");
    const sentCode = smsChannel.sendSms.mock.calls[0][0].code;

    const outcome = await manager.verify("user-1", "sms", sentCode);
    expect(outcome.valid).toBe(true);
    expect(await manager.isEnabled("user-1", "sms")).toBe(true);
  });

  it("verify() with a wrong code fails without throwing", async () => {
    const { manager } = createTestManager();
    await manager.enrollSms("user-1", "+15551234567");
    await manager.sendChallenge("user-1", "sms");

    const outcome = await manager.verify("user-1", "sms", "000000");
    expect(outcome).toEqual({ valid: false, reason: "invalid_code" });
  });

  it("verify() fails cleanly when no challenge was ever sent", async () => {
    const { manager } = createTestManager();
    await manager.enrollSms("user-1", "+15551234567");
    const outcome = await manager.verify("user-1", "sms", "123456");
    expect(outcome.valid).toBe(false);
  });

  it("verify() enforces attempts_exhausted after maxAttempts wrong guesses", async () => {
    const { manager } = createTestManager();
    await manager.enrollSms("user-1", "+15551234567");
    await manager.sendChallenge("user-1", "sms");

    for (let i = 0; i < 5; i++) {
      await manager.verify("user-1", "sms", "000000");
    }
    const outcome = await manager.verify("user-1", "sms", "000000");
    expect(outcome.reason).toBe("attempts_exhausted");
  });

  it("sendChallenge throws ProviderUnavailableError if no SmsChannel is configured", async () => {
    const secretStore = new InMemorySecretStore();
    const manager = new TwoFactorManager({ secretStore, issuer: "Acme", rateLimiter: generousRateLimiter() });
    await manager.enrollSms("user-1", "+15551234567");
    await expect(manager.sendChallenge("user-1", "sms")).rejects.toThrow(ProviderUnavailableError);
  });

  it("sendChallenge wraps delivery failures (after retries) in ProviderUnavailableError", async () => {
    const secretStore = new InMemorySecretStore();
    const smsChannel = { sendSms: jest.fn().mockRejectedValue(new Error("carrier down")) };
    const manager = new TwoFactorManager({
      secretStore,
      issuer: "Acme",
      rateLimiter: generousRateLimiter(),
      smsChannel,
      retry: { retries: 2, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await manager.enrollSms("user-1", "+15551234567");
    await expect(manager.sendChallenge("user-1", "sms")).rejects.toThrow(ProviderUnavailableError);
    expect(smsChannel.sendSms).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("sendChallenge succeeds after transient failures within the retry budget", async () => {
    const secretStore = new InMemorySecretStore();
    const smsChannel = {
      sendSms: jest.fn().mockRejectedValueOnce(new Error("transient")).mockResolvedValueOnce(undefined),
    };
    const manager = new TwoFactorManager({
      secretStore,
      issuer: "Acme",
      rateLimiter: generousRateLimiter(),
      smsChannel,
      retry: { retries: 2, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await manager.enrollSms("user-1", "+15551234567");
    await expect(manager.sendChallenge("user-1", "sms")).resolves.toMatchObject({ sent: true });
  });
});

describe("TwoFactorManager: email enrollment, challenge, verify", () => {
  it("rejects enrolling an invalid email address", async () => {
    const { manager } = createTestManager();
    await expect(manager.enrollEmail("user-1", "not-an-email")).rejects.toThrow(InvalidDestinationError);
  });

  it("sendChallenge + verify round trip via EmailChannel", async () => {
    const { manager, emailChannel } = createTestManager();
    await manager.enrollEmail("user-1", "user-1@example.com");
    await manager.sendChallenge("user-1", "email");
    const sentCode = emailChannel.sendEmail.mock.calls[0][0].code;

    const outcome = await manager.verify("user-1", "email", sentCode);
    expect(outcome.valid).toBe(true);
  });
});

describe("TwoFactorManager: rate limiting", () => {
  it("verify() throws RateLimitedError with retryAfterMs once the limit is hit", async () => {
    const rateLimiter = new InMemoryRateLimiter({ maxAttempts: 2, windowMs: 60_000, lockoutMs: 5_000 });
    const { manager } = createTestManager({ rateLimiter });
    await manager.enrollSms("user-1", "+15551234567");
    await manager.sendChallenge("user-1", "sms");

    await manager.verify("user-1", "sms", "000000");
    await manager.verify("user-1", "sms", "000000");

    await expect(manager.verify("user-1", "sms", "000000")).rejects.toThrow(RateLimitedError);
    try {
      await manager.verify("user-1", "sms", "000000");
      throw new Error("expected RateLimitedError");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitedError);
      expect((err as RateLimitedError).retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("a successful verify resets the rate limit counter", async () => {
    const rateLimiter = new InMemoryRateLimiter({ maxAttempts: 2, windowMs: 60_000, lockoutMs: 5_000 });
    const { manager, smsChannel } = createTestManager({ rateLimiter });
    await manager.enrollSms("user-1", "+15551234567");
    await manager.sendChallenge("user-1", "sms");
    const sentCode = smsChannel.sendSms.mock.calls[0][0].code;

    await manager.verify("user-1", "sms", sentCode);

    // fresh challenge, fresh attempts — should not be rate limited from the prior success
    await manager.sendChallenge("user-1", "sms");
    await expect(manager.verify("user-1", "sms", "000000")).resolves.toMatchObject({ valid: false });
  });
});

describe("TwoFactorManager: disable / isEnabled / listEnabledMethods", () => {
  it("lists only enabled methods", async () => {
    const { manager } = createTestManager();
    const { otpauthUrl } = await manager.enrollTotp("user-1", "u@example.com");
    await manager.confirmTotpEnrollment("user-1", generateTotp(extractSecret(otpauthUrl)));

    await manager.enrollSms("user-1", "+15551234567"); // not yet confirmed

    expect(await manager.listEnabledMethods("user-1")).toEqual(["totp"]);
  });

  it("disable removes the enrollment and any pending challenge", async () => {
    const { manager, secretStore } = createTestManager();
    await manager.enrollSms("user-1", "+15551234567");
    await manager.sendChallenge("user-1", "sms");

    await manager.disable("user-1", "sms");

    expect(await secretStore.getEnrollment("user-1", "sms")).toBeUndefined();
    expect(await secretStore.getChallenge("user-1", "sms")).toBeUndefined();
    await expect(manager.sendChallenge("user-1", "sms")).rejects.toThrow(NotEnrolledError);
  });

  it("isEnabled is false for an unknown user/method", async () => {
    const { manager } = createTestManager();
    expect(await manager.isEnabled("nobody", "totp")).toBe(false);
  });
});
