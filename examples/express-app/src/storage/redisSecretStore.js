const METHODS = ["totp", "sms", "email"];

function enrollmentKey(userId, method) {
  return `enrollment:${userId}:${method}`;
}

function challengeKey(userId, method) {
  return `challenge:${userId}:${method}`;
}

function serializeEnrollment(record) {
  return JSON.stringify({
    userId: record.userId,
    method: record.method,
    enabled: record.enabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    secret: record.secret ? record.secret.toString("base64") : undefined,
    destination: record.destination,
    lastAcceptedCounter: record.lastAcceptedCounter,
  });
}

function deserializeEnrollment(raw) {
  if (!raw) return undefined;
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  return {
    userId: obj.userId,
    method: obj.method,
    enabled: obj.enabled,
    createdAt: new Date(obj.createdAt),
    updatedAt: new Date(obj.updatedAt),
    secret: obj.secret ? Buffer.from(obj.secret, "base64") : undefined,
    destination: obj.destination,
    lastAcceptedCounter: obj.lastAcceptedCounter,
  };
}

/**
 * SecretStore implementation backed by Upstash Redis — persists enrollments/challenges
 * across restarts and redeploys, unlike express-2fa-kit's bundled InMemorySecretStore.
 * Challenge attempt counting uses HINCRBY specifically because it must be atomic (see
 * docs/providers.md in the main repo) — a plain read-increment-write would let concurrent
 * verify attempts race past the configured limit.
 */
class RedisSecretStore {
  constructor(redis) {
    this.redis = redis;
  }

  async getEnrollment(userId, method) {
    const raw = await this.redis.get(enrollmentKey(userId, method));
    return deserializeEnrollment(raw);
  }

  async saveEnrollment(record) {
    await this.redis.set(enrollmentKey(record.userId, record.method), serializeEnrollment(record));
  }

  async deleteEnrollment(userId, method) {
    await this.redis.del(enrollmentKey(userId, method));
  }

  async listEnrollments(userId) {
    const records = await Promise.all(METHODS.map((method) => this.getEnrollment(userId, method)));
    return records.filter(Boolean);
  }

  async updateLastAcceptedCounter(userId, counter) {
    const record = await this.getEnrollment(userId, "totp");
    if (!record) return;
    record.lastAcceptedCounter = counter;
    record.updatedAt = new Date();
    await this.saveEnrollment(record);
  }

  async saveChallenge(challenge) {
    const key = challengeKey(challenge.userId, challenge.method);
    await this.redis.hset(key, {
      codeHash: challenge.codeHash,
      expiresAt: challenge.expiresAt.toISOString(),
      attempts: String(challenge.attempts),
      maxAttempts: String(challenge.maxAttempts),
      createdAt: challenge.createdAt.toISOString(),
    });
  }

  async getChallenge(userId, method) {
    const data = await this.redis.hgetall(challengeKey(userId, method));
    if (!data || !data.codeHash) return undefined;
    return {
      userId,
      method,
      codeHash: data.codeHash,
      expiresAt: new Date(data.expiresAt),
      attempts: Number(data.attempts),
      maxAttempts: Number(data.maxAttempts),
      createdAt: new Date(data.createdAt),
    };
  }

  async incrementChallengeAttempts(userId, method) {
    const key = challengeKey(userId, method);
    const exists = await this.redis.exists(key);
    if (!exists) return 0;
    return this.redis.hincrby(key, "attempts", 1);
  }

  async deleteChallenge(userId, method) {
    await this.redis.del(challengeKey(userId, method));
  }
}

module.exports = { RedisSecretStore };
