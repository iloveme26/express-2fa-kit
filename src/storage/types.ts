export type MethodType = "totp" | "sms" | "email";

export interface EnrollmentRecord {
  userId: string;
  method: MethodType;
  /** True once the user has confirmed enrollment with a valid code. */
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** TOTP only: raw (non-base32) secret bytes. */
  secret?: Buffer;
  /** SMS/email only: phone number or email address codes are delivered to. */
  destination?: string;
  /** TOTP only: highest accepted time-step counter, to reject replays of a captured code. */
  lastAcceptedCounter?: number;
}

export interface OtpChallengeRecord {
  userId: string;
  method: "sms" | "email";
  /** sha256 hex digest of the code — the plaintext code is never persisted. */
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

/**
 * Persistence boundary for enrollment state and in-flight SMS/email challenges.
 * Implement this against your own database/cache to replace {@link InMemorySecretStore}.
 */
export interface SecretStore {
  getEnrollment(userId: string, method: MethodType): Promise<EnrollmentRecord | undefined>;
  saveEnrollment(record: EnrollmentRecord): Promise<void>;
  deleteEnrollment(userId: string, method: MethodType): Promise<void>;
  listEnrollments(userId: string): Promise<EnrollmentRecord[]>;
  /** Persists the new TOTP replay high-water mark. No-ops if the enrollment doesn't exist. */
  updateLastAcceptedCounter(userId: string, counter: number): Promise<void>;

  saveChallenge(challenge: OtpChallengeRecord): Promise<void>;
  getChallenge(userId: string, method: "sms" | "email"): Promise<OtpChallengeRecord | undefined>;
  /**
   * Atomically increments and returns the new attempt count. Implementations backed by a
   * real database/cache MUST make this atomic (e.g. `UPDATE ... SET attempts = attempts + 1
   * RETURNING attempts`, or Redis `INCR`) so concurrent verify requests can't bypass the
   * attempt limit via a read-modify-write race.
   */
  incrementChallengeAttempts(userId: string, method: "sms" | "email"): Promise<number>;
  deleteChallenge(userId: string, method: "sms" | "email"): Promise<void>;
}
