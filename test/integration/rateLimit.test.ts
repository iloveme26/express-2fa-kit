import request from "supertest";
import { InMemoryRateLimiter } from "../../src/ratelimit/memoryRateLimiter";
import { createTestApp } from "../helpers/app";

describe("Rate limiting (integration)", () => {
  it("returns 429 with a Retry-After header after repeated wrong codes", async () => {
    const rateLimiter = new InMemoryRateLimiter({ maxAttempts: 2, windowMs: 60_000, lockoutMs: 10_000 });
    const { app } = createTestApp(rateLimiter);
    const headers = { "x-user-id": "user-1", "x-session-id": "s1" };

    await request(app).post("/2fa/sms/enroll").set(headers).send({ phoneNumber: "+15551234567" });
    await request(app).post("/2fa/sms/send").set(headers).send();

    await request(app).post("/2fa/verify").set(headers).send({ method: "sms", code: "000000" });
    await request(app).post("/2fa/verify").set(headers).send({ method: "sms", code: "000000" });
    const res = await request(app).post("/2fa/verify").set(headers).send({ method: "sms", code: "000000" });

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("10");
    expect(res.body.error).toBe("rate_limited");
  });
});
