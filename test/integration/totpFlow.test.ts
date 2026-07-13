import request from "supertest";
import { base32Decode } from "../../src/crypto/base32";
import { generateTotp } from "../../src/crypto/totp";
import { createTestApp } from "../helpers/app";

function extractSecret(otpauthUrl: string): Buffer {
  const query = new URLSearchParams(otpauthUrl.split("?")[1]);
  return base32Decode(query.get("secret") as string);
}

describe("TOTP flow (integration)", () => {
  it("enroll -> confirm -> verify -> protected route unlocks -> replay rejected", async () => {
    const { app } = createTestApp();
    const headers = { "x-user-id": "user-1", "x-session-id": "s1" };

    const enrollRes = await request(app).post("/2fa/totp/enroll").set(headers).send({ accountName: "user-1" });
    expect(enrollRes.status).toBe(200);
    const secret = extractSecret(enrollRes.body.otpauthUrl);

    const code = generateTotp(secret);
    const confirmRes = await request(app).post("/2fa/totp/confirm").set(headers).send({ code });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.valid).toBe(true);

    const before = await request(app).get("/protected").set(headers);
    expect(before.status).toBe(401);

    const nextCode = generateTotp(secret, { timestamp: Date.now() + 30_000 });
    const verifyRes = await request(app).post("/2fa/verify").set(headers).send({ method: "totp", code: nextCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);

    const after = await request(app).get("/protected").set(headers);
    expect(after.status).toBe(200);

    const replay = await request(app).post("/2fa/verify").set(headers).send({ method: "totp", code: nextCode });
    expect(replay.body.valid).toBe(false);
  });

  it("rejects confirming with a wrong code", async () => {
    const { app } = createTestApp();
    const headers = { "x-user-id": "user-2", "x-session-id": "s2" };

    await request(app).post("/2fa/totp/enroll").set(headers).send({ accountName: "user-2" });
    const confirmRes = await request(app).post("/2fa/totp/confirm").set(headers).send({ code: "000000" });
    expect(confirmRes.body.valid).toBe(false);
  });
});
