import { InMemorySecretStore } from "../../../src/storage/memoryStore";
import { EnrollmentRecord, OtpChallengeRecord } from "../../../src/storage/types";

function makeEnrollment(overrides: Partial<EnrollmentRecord> = {}): EnrollmentRecord {
  const now = new Date();
  return {
    userId: "user-1",
    method: "totp",
    enabled: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeChallenge(overrides: Partial<OtpChallengeRecord> = {}): OtpChallengeRecord {
  return {
    userId: "user-1",
    method: "sms",
    codeHash: "hash",
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    maxAttempts: 5,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("InMemorySecretStore enrollments", () => {
  it("returns undefined for an unknown enrollment", async () => {
    const store = new InMemorySecretStore();
    expect(await store.getEnrollment("nobody", "totp")).toBeUndefined();
  });

  it("round trips save/get", async () => {
    const store = new InMemorySecretStore();
    const record = makeEnrollment({ secret: Buffer.from("abc") });
    await store.saveEnrollment(record);
    expect(await store.getEnrollment("user-1", "totp")).toEqual(record);
  });

  it("deletes an enrollment", async () => {
    const store = new InMemorySecretStore();
    await store.saveEnrollment(makeEnrollment());
    await store.deleteEnrollment("user-1", "totp");
    expect(await store.getEnrollment("user-1", "totp")).toBeUndefined();
  });

  it("is idempotent when deleting a missing enrollment", async () => {
    const store = new InMemorySecretStore();
    await expect(store.deleteEnrollment("nobody", "totp")).resolves.toBeUndefined();
  });

  it("lists all enrollments for a user across methods", async () => {
    const store = new InMemorySecretStore();
    await store.saveEnrollment(makeEnrollment({ method: "totp" }));
    await store.saveEnrollment(makeEnrollment({ method: "sms", destination: "+15551234567" }));
    await store.saveEnrollment(makeEnrollment({ userId: "user-2", method: "email", destination: "a@b.com" }));

    const records = await store.listEnrollments("user-1");
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.method).sort()).toEqual(["sms", "totp"]);
  });

  it("updates the TOTP replay high-water mark", async () => {
    const store = new InMemorySecretStore();
    await store.saveEnrollment(makeEnrollment({ secret: Buffer.from("abc"), lastAcceptedCounter: 1 }));
    await store.updateLastAcceptedCounter("user-1", 5);
    const record = await store.getEnrollment("user-1", "totp");
    expect(record?.lastAcceptedCounter).toBe(5);
  });

  it("no-ops updating the counter for a missing enrollment", async () => {
    const store = new InMemorySecretStore();
    await expect(store.updateLastAcceptedCounter("nobody", 5)).resolves.toBeUndefined();
  });
});

describe("InMemorySecretStore challenges", () => {
  it("round trips save/get", async () => {
    const store = new InMemorySecretStore();
    const challenge = makeChallenge();
    await store.saveChallenge(challenge);
    expect(await store.getChallenge("user-1", "sms")).toEqual(challenge);
  });

  it("returns undefined for a missing challenge", async () => {
    const store = new InMemorySecretStore();
    expect(await store.getChallenge("user-1", "sms")).toBeUndefined();
  });

  it("increments attempts and returns the new count", async () => {
    const store = new InMemorySecretStore();
    await store.saveChallenge(makeChallenge({ attempts: 0 }));
    expect(await store.incrementChallengeAttempts("user-1", "sms")).toBe(1);
    expect(await store.incrementChallengeAttempts("user-1", "sms")).toBe(2);
  });

  it("returns 0 incrementing a missing challenge without throwing", async () => {
    const store = new InMemorySecretStore();
    expect(await store.incrementChallengeAttempts("nobody", "sms")).toBe(0);
  });

  it("deletes a challenge, idempotently", async () => {
    const store = new InMemorySecretStore();
    await store.saveChallenge(makeChallenge());
    await store.deleteChallenge("user-1", "sms");
    expect(await store.getChallenge("user-1", "sms")).toBeUndefined();
    await expect(store.deleteChallenge("user-1", "sms")).resolves.toBeUndefined();
  });

  it("keeps sms and email challenges for the same user independent", async () => {
    const store = new InMemorySecretStore();
    await store.saveChallenge(makeChallenge({ method: "sms", codeHash: "sms-hash" }));
    await store.saveChallenge(makeChallenge({ method: "email", codeHash: "email-hash" }));
    expect((await store.getChallenge("user-1", "sms"))?.codeHash).toBe("sms-hash");
    expect((await store.getChallenge("user-1", "email"))?.codeHash).toBe("email-hash");
  });
});
