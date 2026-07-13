import { withRetry } from "../channels/retry";
import { EmailChannel, SmsChannel } from "../channels/types";
import { TotpOptions } from "../crypto/totp";
import { createEmailChallenge, verifyEmailCode } from "../methods/email";
import { createSmsChallenge, verifySmsCode } from "../methods/sms";
import { buildOtpauthUri, generateTotpQrCode, generateTotpSecret, verifyTotpCode } from "../methods/totp";
import { InMemoryRateLimiter } from "../ratelimit/memoryRateLimiter";
import { RateLimiter } from "../ratelimit/types";
import { EnrollmentRecord, MethodType } from "../storage/types";
import { InvalidDestinationError, NotEnrolledError, ProviderUnavailableError, RateLimitedError } from "./errors";
import { OtpMethodConfig, TwoFactorManagerConfig, VerifyOutcome } from "./types";

function resolveOtpMethodConfig(config?: OtpMethodConfig): Required<OtpMethodConfig> {
  return {
    digits: config?.digits ?? 6,
    ttlSeconds: config?.ttlSeconds ?? 600,
    maxAttempts: config?.maxAttempts ?? 5,
  };
}

/**
 * Framework-agnostic orchestrator tying together secret storage, delivery channels, and
 * rate limiting for TOTP/SMS/email 2FA. Works standalone with zero Express dependency —
 * see src/middleware for Express-specific bindings (imported from the `express-2fa-kit/express`
 * subpath).
 */
export class TwoFactorManager {
  private readonly secretStore: TwoFactorManagerConfig["secretStore"];
  private readonly issuer: string;
  private readonly rateLimiter: RateLimiter;
  private readonly smsChannel?: SmsChannel;
  private readonly emailChannel?: EmailChannel;
  private readonly totpOptions: TotpOptions;
  private readonly smsConfig: Required<OtpMethodConfig>;
  private readonly emailConfig: Required<OtpMethodConfig>;
  private readonly retryOptions: TwoFactorManagerConfig["retry"];

  constructor(config: TwoFactorManagerConfig) {
    this.secretStore = config.secretStore;
    this.issuer = config.issuer;
    this.rateLimiter = config.rateLimiter ?? new InMemoryRateLimiter(config.rateLimit);
    this.smsChannel = config.smsChannel;
    this.emailChannel = config.emailChannel;
    this.totpOptions = config.totp ?? {};
    this.smsConfig = resolveOtpMethodConfig(config.sms);
    this.emailConfig = resolveOtpMethodConfig(config.email);
    this.retryOptions = config.retry;
  }

  /**
   * Starts (or restarts) TOTP enrollment: generates a fresh secret, persists it as an
   * unconfirmed enrollment (overwriting any prior draft or active TOTP enrollment), and
   * returns the provisioning URI/QR code to show the user. Call confirmTotpEnrollment()
   * with a code from their authenticator app to activate it.
   */
  async enrollTotp(userId: string, accountName: string): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
    const secret = generateTotpSecret();
    const now = new Date();
    await this.secretStore.saveEnrollment({
      userId,
      method: "totp",
      enabled: false,
      createdAt: now,
      updatedAt: now,
      secret,
    });

    const otpauthUrl = buildOtpauthUri({
      secret,
      accountName,
      issuer: this.issuer,
      algorithm: this.totpOptions.algorithm,
      digits: this.totpOptions.digits,
      step: this.totpOptions.step,
    });
    const qrCodeDataUrl = await generateTotpQrCode(otpauthUrl);

    return { otpauthUrl, qrCodeDataUrl };
  }

  /** Confirms a pending TOTP enrollment, activating it on success. */
  async confirmTotpEnrollment(userId: string, code: string): Promise<{ valid: boolean }> {
    const record = await this.secretStore.getEnrollment(userId, "totp");
    if (!record || !record.secret) {
      throw new NotEnrolledError();
    }

    const result = verifyTotpCode(record.secret, code, {
      ...this.totpOptions,
      lastAcceptedCounter: record.lastAcceptedCounter,
    });
    if (!result.valid || result.matchedStep === undefined) {
      return { valid: false };
    }

    record.enabled = true;
    record.lastAcceptedCounter = result.matchedStep;
    record.updatedAt = new Date();
    await this.secretStore.saveEnrollment(record);

    return { valid: true };
  }

  /** Registers a phone number for SMS 2FA. Enrollment activates on the first successful verify(). */
  async enrollSms(userId: string, phoneNumber: string): Promise<void> {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      throw new InvalidDestinationError("A phone number is required to enroll SMS 2FA.");
    }
    const now = new Date();
    await this.secretStore.saveEnrollment({
      userId,
      method: "sms",
      enabled: false,
      createdAt: now,
      updatedAt: now,
      destination: phoneNumber,
    });
  }

  /** Registers an email address for email 2FA. Enrollment activates on the first successful verify(). */
  async enrollEmail(userId: string, emailAddress: string): Promise<void> {
    if (!emailAddress || !emailAddress.includes("@")) {
      throw new InvalidDestinationError("A valid email address is required to enroll email 2FA.");
    }
    const now = new Date();
    await this.secretStore.saveEnrollment({
      userId,
      method: "email",
      enabled: false,
      createdAt: now,
      updatedAt: now,
      destination: emailAddress,
    });
  }

  /** Generates and delivers a fresh SMS/email code. Retries delivery with backoff before giving up. */
  async sendChallenge(userId: string, method: "sms" | "email"): Promise<{ sent: true; expiresAt: Date }> {
    const record = await this.secretStore.getEnrollment(userId, method);
    if (!record || !record.destination) {
      throw new NotEnrolledError();
    }
    if (method === "sms" && !this.smsChannel) {
      throw new ProviderUnavailableError("No SmsChannel configured.");
    }
    if (method === "email" && !this.emailChannel) {
      throw new ProviderUnavailableError("No EmailChannel configured.");
    }

    const decision = await this.rateLimiter.consume(`send:${userId}:${method}`);
    if (!decision.allowed) {
      throw new RateLimitedError(decision.retryAfterMs ?? 0);
    }

    const config = method === "sms" ? this.smsConfig : this.emailConfig;
    const challenge = method === "sms" ? createSmsChallenge(config) : createEmailChallenge(config);
    const destination = record.destination;

    await this.secretStore.saveChallenge({
      userId,
      method,
      codeHash: challenge.codeHash,
      expiresAt: challenge.expiresAt,
      attempts: 0,
      maxAttempts: challenge.maxAttempts,
      createdAt: new Date(),
    });

    try {
      if (method === "sms") {
        const channel = this.smsChannel!;
        await withRetry(
          () => channel.sendSms({ to: destination, code: challenge.code, expiresInSeconds: config.ttlSeconds }),
          this.retryOptions
        );
      } else {
        const channel = this.emailChannel!;
        await withRetry(
          () => channel.sendEmail({ to: destination, code: challenge.code, expiresInSeconds: config.ttlSeconds }),
          this.retryOptions
        );
      }
    } catch (err) {
      throw new ProviderUnavailableError("Failed to deliver the verification code.", err);
    }

    return { sent: true, expiresAt: challenge.expiresAt };
  }

  /**
   * Verifies a code for the given method. Throws for conditions that mean the attempt
   * couldn't be evaluated at all (not enrolled, rate limited); returns `{ valid: false }`
   * for a wrong/expired/replayed/exhausted code — the expected path for a UI retry loop.
   */
  async verify(
    userId: string,
    method: MethodType,
    code: string,
    context: { ip?: string } = {}
  ): Promise<VerifyOutcome> {
    const record = await this.secretStore.getEnrollment(userId, method);
    if (!record) {
      throw new NotEnrolledError();
    }
    if (method === "totp" && (!record.enabled || !record.secret)) {
      throw new NotEnrolledError("TOTP enrollment has not been confirmed yet.");
    }

    const rateLimitKeys = [`verify:${userId}:${method}`];
    if (context.ip) {
      rateLimitKeys.push(`verify-ip:${context.ip}:${method}`);
    }
    for (const key of rateLimitKeys) {
      const decision = await this.rateLimiter.consume(key);
      if (!decision.allowed) {
        throw new RateLimitedError(decision.retryAfterMs ?? 0);
      }
    }

    const outcome = method === "totp" ? await this.verifyTotp(userId, record, code) : await this.verifyOtp(userId, method, record, code);

    if (outcome.valid) {
      for (const key of rateLimitKeys) {
        await this.rateLimiter.reset(key);
      }
    }

    return outcome;
  }

  private async verifyTotp(userId: string, record: EnrollmentRecord, code: string): Promise<VerifyOutcome> {
    const result = verifyTotpCode(record.secret as Buffer, code, {
      ...this.totpOptions,
      lastAcceptedCounter: record.lastAcceptedCounter,
    });
    if (!result.valid || result.matchedStep === undefined) {
      return { valid: false, reason: "invalid_code" };
    }
    await this.secretStore.updateLastAcceptedCounter(userId, result.matchedStep);
    return { valid: true };
  }

  private async verifyOtp(
    userId: string,
    method: "sms" | "email",
    record: EnrollmentRecord,
    code: string
  ): Promise<VerifyOutcome> {
    const challenge = await this.secretStore.getChallenge(userId, method);
    if (!challenge) {
      return { valid: false, reason: "invalid_code" };
    }

    const attempts = await this.secretStore.incrementChallengeAttempts(userId, method);
    const verifyFn = method === "sms" ? verifySmsCode : verifyEmailCode;
    const result = verifyFn(
      { codeHash: challenge.codeHash, expiresAt: challenge.expiresAt, maxAttempts: challenge.maxAttempts },
      code,
      attempts
    );

    if (!result.valid) {
      return result;
    }

    await this.secretStore.deleteChallenge(userId, method);
    if (!record.enabled) {
      record.enabled = true;
      record.updatedAt = new Date();
      await this.secretStore.saveEnrollment(record);
    }

    return result;
  }

  /** Removes a method's enrollment (and any in-flight SMS/email challenge). */
  async disable(userId: string, method: MethodType): Promise<void> {
    await this.secretStore.deleteEnrollment(userId, method);
    if (method !== "totp") {
      await this.secretStore.deleteChallenge(userId, method);
    }
  }

  async isEnabled(userId: string, method: MethodType): Promise<boolean> {
    const record = await this.secretStore.getEnrollment(userId, method);
    return record?.enabled ?? false;
  }

  async listEnabledMethods(userId: string): Promise<MethodType[]> {
    const records = await this.secretStore.listEnrollments(userId);
    return records.filter((record) => record.enabled).map((record) => record.method);
  }
}
