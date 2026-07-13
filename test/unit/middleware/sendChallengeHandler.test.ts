import { NotEnrolledError, ProviderUnavailableError } from "../../../src/core/errors";
import { TwoFactorManager } from "../../../src/core/manager";
import { createSendChallengeHandler } from "../../../src/middleware/sendChallengeHandler";
import { fakeReq, fakeRes } from "./testDoubles";

function fakeManager(sendChallenge: jest.Mock): TwoFactorManager {
  return { sendChallenge } as unknown as TwoFactorManager;
}

describe("createSendChallengeHandler", () => {
  it("responds 401 when there is no authenticated user", async () => {
    const handler = createSendChallengeHandler({ manager: fakeManager(jest.fn()) });
    const req = fakeReq({ params: { method: "sms" } });
    const res = fakeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(401);
  });

  it("responds 400 for an unsupported method param", async () => {
    const handler = createSendChallengeHandler({ manager: fakeManager(jest.fn()) });
    const req = fakeReq({ user: { id: "user-1" }, params: { method: "totp" } });
    const res = fakeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "invalid_method" });
  });

  it("sends and returns the expiry on success", async () => {
    const expiresAt = new Date("2026-01-01T00:00:00.000Z");
    const sendChallenge = jest.fn().mockResolvedValue({ sent: true, expiresAt });
    const req = fakeReq({ user: { id: "user-1" }, params: { method: "sms" } });
    const res = fakeRes();

    const handler = createSendChallengeHandler({ manager: fakeManager(sendChallenge) });
    await handler(req, res, jest.fn());

    expect(sendChallenge).toHaveBeenCalledWith("user-1", "sms");
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ sent: true, expiresAt: expiresAt.toISOString() });
  });

  it("maps NotEnrolledError to 400", async () => {
    const sendChallenge = jest.fn().mockRejectedValue(new NotEnrolledError());
    const req = fakeReq({ user: { id: "user-1" }, params: { method: "email" } });
    const res = fakeRes();

    const handler = createSendChallengeHandler({ manager: fakeManager(sendChallenge) });
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(400);
  });

  it("maps ProviderUnavailableError to 503", async () => {
    const sendChallenge = jest.fn().mockRejectedValue(new ProviderUnavailableError());
    const req = fakeReq({ user: { id: "user-1" }, params: { method: "sms" } });
    const res = fakeRes();

    const handler = createSendChallengeHandler({ manager: fakeManager(sendChallenge) });
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(503);
  });
});
