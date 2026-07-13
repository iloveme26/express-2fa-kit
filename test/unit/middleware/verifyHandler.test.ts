import { NotEnrolledError, RateLimitedError } from "../../../src/core/errors";
import { TwoFactorManager } from "../../../src/core/manager";
import { expressSessionAdapter } from "../../../src/middleware/session";
import { createVerifyHandler } from "../../../src/middleware/verifyHandler";
import { fakeReq, fakeRes } from "./testDoubles";

function fakeManager(verify: jest.Mock): TwoFactorManager {
  return { verify } as unknown as TwoFactorManager;
}

describe("createVerifyHandler", () => {
  it("responds 401 when there is no authenticated user", async () => {
    const handler = createVerifyHandler({ manager: fakeManager(jest.fn()) });
    const req = fakeReq({});
    const res = fakeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(401);
  });

  it("responds 400 when method or code is missing from the body", async () => {
    const handler = createVerifyHandler({ manager: fakeManager(jest.fn()) });
    const req = fakeReq({ user: { id: "user-1" }, body: { method: "totp" } });
    const res = fakeRes();

    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "invalid_request" });
  });

  it("marks the session verified and returns 200 on a valid code", async () => {
    const verify = jest.fn().mockResolvedValue({ valid: true });
    const sessionAdapter = expressSessionAdapter();
    const req = fakeReq({ user: { id: "user-1" }, body: { method: "totp", code: "123456" } });
    const res = fakeRes();

    const handler = createVerifyHandler({ manager: fakeManager(verify), sessionAdapter });
    await handler(req, res, jest.fn());

    expect(verify).toHaveBeenCalledWith("user-1", "totp", "123456", { ip: req.ip });
    expect(sessionAdapter.isVerified(req)).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ valid: true });
  });

  it("does not mark the session verified when the code is wrong", async () => {
    const verify = jest.fn().mockResolvedValue({ valid: false, reason: "invalid_code" });
    const sessionAdapter = expressSessionAdapter();
    const req = fakeReq({ user: { id: "user-1" }, body: { method: "totp", code: "000000" } });
    const res = fakeRes();

    const handler = createVerifyHandler({ manager: fakeManager(verify), sessionAdapter });
    await handler(req, res, jest.fn());

    expect(sessionAdapter.isVerified(req)).toBe(false);
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ valid: false, reason: "invalid_code" });
  });

  it("maps a RateLimitedError to 429 with a Retry-After header", async () => {
    const verify = jest.fn().mockRejectedValue(new RateLimitedError(5000));
    const req = fakeReq({ user: { id: "user-1" }, body: { method: "totp", code: "000000" } });
    const res = fakeRes();

    const handler = createVerifyHandler({ manager: fakeManager(verify) });
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("5");
  });

  it("maps a NotEnrolledError to 400", async () => {
    const verify = jest.fn().mockRejectedValue(new NotEnrolledError());
    const req = fakeReq({ user: { id: "user-1" }, body: { method: "totp", code: "000000" } });
    const res = fakeRes();

    const handler = createVerifyHandler({ manager: fakeManager(verify) });
    await handler(req, res, jest.fn());

    expect(res.statusCode).toBe(400);
  });
});
