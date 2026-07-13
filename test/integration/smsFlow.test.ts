import request from "supertest";
import { createTestApp } from "../helpers/app";

describe("SMS flow (integration)", () => {
  it("enroll -> send -> verify activates the method", async () => {
    const { app, smsChannel } = createTestApp();
    const headers = { "x-user-id": "user-1", "x-session-id": "s1" };

    const enrollRes = await request(app).post("/2fa/sms/enroll").set(headers).send({ phoneNumber: "+15551234567" });
    expect(enrollRes.status).toBe(200);

    const sendRes = await request(app).post("/2fa/sms/send").set(headers).send();
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.sent).toBe(true);

    const code = smsChannel.lastCode();
    expect(code).toMatch(/^\d{6}$/);

    const verifyRes = await request(app).post("/2fa/verify").set(headers).send({ method: "sms", code });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
  });

  it("rejects reusing a code that was already consumed", async () => {
    const { app, smsChannel } = createTestApp();
    const headers = { "x-user-id": "user-1", "x-session-id": "s1" };

    await request(app).post("/2fa/sms/enroll").set(headers).send({ phoneNumber: "+15551234567" });
    await request(app).post("/2fa/sms/send").set(headers).send();
    const code = smsChannel.lastCode();

    const first = await request(app).post("/2fa/verify").set(headers).send({ method: "sms", code });
    expect(first.body.valid).toBe(true);

    const second = await request(app).post("/2fa/verify").set(headers).send({ method: "sms", code });
    expect(second.body.valid).toBe(false);
  });

  it("rejects a bad phone number at enrollment", async () => {
    const { app } = createTestApp();
    const headers = { "x-user-id": "user-1", "x-session-id": "s1" };

    const res = await request(app).post("/2fa/sms/enroll").set(headers).send({ phoneNumber: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_destination");
  });
});
