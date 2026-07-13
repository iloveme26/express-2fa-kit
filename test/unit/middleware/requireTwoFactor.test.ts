import { expressSessionAdapter } from "../../../src/middleware/session";
import { requireTwoFactor } from "../../../src/middleware/requireTwoFactor";
import { fakeReq, fakeRes } from "./testDoubles";

describe("requireTwoFactor", () => {
  it("calls next() when the user is authenticated and 2FA-verified", () => {
    const adapter = expressSessionAdapter();
    const req = fakeReq({ user: { id: "user-1" } });
    adapter.markVerified(req, "totp");
    const res = fakeRes();
    const next = jest.fn();

    requireTwoFactor({ sessionAdapter: adapter })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200); // untouched
  });

  it("responds 401 when there is no authenticated user", () => {
    const req = fakeReq({});
    const res = fakeRes();
    const next = jest.fn();

    requireTwoFactor()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: "two_factor_required" });
  });

  it("responds 401 when the user is authenticated but not verified", () => {
    const req = fakeReq({ user: { id: "user-1" } });
    const res = fakeRes();
    const next = jest.fn();

    requireTwoFactor()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("supports a custom getUserId", () => {
    const adapter = expressSessionAdapter();
    const req = fakeReq({ customUserId: "user-1" });
    adapter.markVerified(req, "totp");
    const res = fakeRes();
    const next = jest.fn();

    requireTwoFactor({
      sessionAdapter: adapter,
      getUserId: (r) => (r as unknown as { customUserId?: string }).customUserId,
    })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("supports a custom onUnverified handler", () => {
    const req = fakeReq({});
    const res = fakeRes();
    const next = jest.fn();
    const onUnverified = jest.fn((_req, r) => r.status(403).json({ error: "custom" }));

    requireTwoFactor({ onUnverified })(req, res, next);

    expect(onUnverified).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(403);
  });
});
