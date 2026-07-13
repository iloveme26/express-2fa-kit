import type { Request } from "express";
import { MethodType } from "../storage/types";

/**
 * Bridges "is this session 2FA-verified" state to whatever session mechanism an app uses.
 * The default {@link expressSessionAdapter} only requires a mutable `req.session` object —
 * it works with express-session, cookie-session, or a hand-rolled equivalent.
 */
export interface SessionAdapter {
  isVerified(req: Request): boolean;
  markVerified(req: Request, method: MethodType): void;
  clearVerified(req: Request): void;
}

export interface ExpressSessionAdapterOptions {
  /** Key under req.session where 2FA state is stored. Default "twoFactor". */
  sessionKey?: string;
}

interface TwoFactorSessionState {
  verified: boolean;
  method?: MethodType;
  verifiedAt?: string;
}

type RequestWithSession = Request & { session?: Record<string, unknown> };

function getSessionBag(req: Request): Record<string, unknown> {
  const session = (req as RequestWithSession).session;
  if (!session) {
    throw new Error(
      "expressSessionAdapter() requires req.session to be set (e.g. by express-session or a " +
        "compatible middleware) before this middleware runs."
    );
  }
  return session;
}

export function expressSessionAdapter(options: ExpressSessionAdapterOptions = {}): SessionAdapter {
  const sessionKey = options.sessionKey ?? "twoFactor";

  return {
    isVerified(req) {
      const session = getSessionBag(req);
      const state = session[sessionKey] as TwoFactorSessionState | undefined;
      return state?.verified ?? false;
    },
    markVerified(req, method) {
      const session = getSessionBag(req);
      const state: TwoFactorSessionState = { verified: true, method, verifiedAt: new Date().toISOString() };
      session[sessionKey] = state;
    },
    clearVerified(req) {
      const session = getSessionBag(req);
      delete session[sessionKey];
    },
  };
}
