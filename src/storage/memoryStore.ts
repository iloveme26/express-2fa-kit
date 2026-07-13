import { EnrollmentRecord, MethodType, OtpChallengeRecord, SecretStore } from "./types";

function enrollmentKey(userId: string, method: MethodType): string {
  return `${userId}:${method}`;
}

function challengeKey(userId: string, method: "sms" | "email"): string {
  return `${userId}:${method}`;
}

/**
 * Reference {@link SecretStore} implementation backed by in-process Maps.
 * Suitable for development, tests, and single-process deployments only —
 * state is lost on restart and not shared across processes/instances.
 */
export class InMemorySecretStore implements SecretStore {
  private readonly enrollments = new Map<string, EnrollmentRecord>();
  private readonly challenges = new Map<string, OtpChallengeRecord>();

  async getEnrollment(userId: string, method: MethodType): Promise<EnrollmentRecord | undefined> {
    return this.enrollments.get(enrollmentKey(userId, method));
  }

  async saveEnrollment(record: EnrollmentRecord): Promise<void> {
    this.enrollments.set(enrollmentKey(record.userId, record.method), record);
  }

  async deleteEnrollment(userId: string, method: MethodType): Promise<void> {
    this.enrollments.delete(enrollmentKey(userId, method));
  }

  async listEnrollments(userId: string): Promise<EnrollmentRecord[]> {
    return Array.from(this.enrollments.values()).filter((record) => record.userId === userId);
  }

  async updateLastAcceptedCounter(userId: string, counter: number): Promise<void> {
    const record = this.enrollments.get(enrollmentKey(userId, "totp"));
    if (!record) return;
    record.lastAcceptedCounter = counter;
    record.updatedAt = new Date();
  }

  async saveChallenge(challenge: OtpChallengeRecord): Promise<void> {
    this.challenges.set(challengeKey(challenge.userId, challenge.method), challenge);
  }

  async getChallenge(userId: string, method: "sms" | "email"): Promise<OtpChallengeRecord | undefined> {
    return this.challenges.get(challengeKey(userId, method));
  }

  async incrementChallengeAttempts(userId: string, method: "sms" | "email"): Promise<number> {
    const challenge = this.challenges.get(challengeKey(userId, method));
    if (!challenge) return 0;
    challenge.attempts += 1;
    return challenge.attempts;
  }

  async deleteChallenge(userId: string, method: "sms" | "email"): Promise<void> {
    this.challenges.delete(challengeKey(userId, method));
  }
}
