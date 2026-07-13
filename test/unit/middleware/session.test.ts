import type { Request } from "express";
import { expressSessionAdapter } from "../../../src/middleware/session";

function fakeReq(session?: Record<string, unknown>): Request {
  return { session } as unknown as Request;
}

describe("expressSessionAdapter", () => {
  it("throws a clear error when req.session is missing", () => {
    const adapter = expressSessionAdapter();
    const req = fakeReq(undefined);
    expect(() => adapter.isVerified(req)).toThrow(/requires req\.session/);
  });

  it("is not verified by default", () => {
    const adapter = expressSessionAdapter();
    const req = fakeReq({});
    expect(adapter.isVerified(req)).toBe(false);
  });

  it("marks and reports verified", () => {
    const adapter = expressSessionAdapter();
    const req = fakeReq({});
    adapter.markVerified(req, "totp");
    expect(adapter.isVerified(req)).toBe(true);
  });

  it("clears verified state", () => {
    const adapter = expressSessionAdapter();
    const req = fakeReq({});
    adapter.markVerified(req, "totp");
    adapter.clearVerified(req);
    expect(adapter.isVerified(req)).toBe(false);
  });

  it("supports a custom session key, isolated from other keys", () => {
    const adapter = expressSessionAdapter({ sessionKey: "myTwoFactor" });
    const session: Record<string, unknown> = { twoFactor: { verified: true } };
    const req = fakeReq(session);
    expect(adapter.isVerified(req)).toBe(false);
    adapter.markVerified(req, "sms");
    expect(session.myTwoFactor).toBeDefined();
    expect(session.twoFactor).toEqual({ verified: true });
  });
});
