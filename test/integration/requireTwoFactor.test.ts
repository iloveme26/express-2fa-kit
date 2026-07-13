import request from "supertest";
import { createTestApp } from "../helpers/app";

describe("requireTwoFactor middleware (integration)", () => {
  it("401s before verification and 200s after", async () => {
    const { app, smsChannel } = createTestApp();
    const headers = { "x-user-id": "user-1", "x-session-id": "s1" };

    const before = await request(app).get("/protected").set(headers);
    expect(before.status).toBe(401);

    await request(app).post("/2fa/sms/enroll").set(headers).send({ phoneNumber: "+15551234567" });
    await request(app).post("/2fa/sms/send").set(headers).send();
    const code = smsChannel.lastCode();
    await request(app).post("/2fa/verify").set(headers).send({ method: "sms", code });

    const after = await request(app).get("/protected").set(headers);
    expect(after.status).toBe(200);
  });

  it("401s an unauthenticated request", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
  });
});
