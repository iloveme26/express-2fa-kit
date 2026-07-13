import type { NextFunction, Request, RequestHandler, Response } from "express";
import { expressSessionAdapter, SessionAdapter } from "./session";

export interface RequireTwoFactorOptions {
  sessionAdapter?: SessionAdapter;
  /** Default: `req.user?.id` (duck-typed, no auth-library dependency). */
  getUserId?: (req: Request) => string | undefined;
  /** Default: responds 401 `{ error: "two_factor_required" }`. */
  onUnverified?: (req: Request, res: Response, next: NextFunction) => void;
}

function defaultGetUserId(req: Request): string | undefined {
  return (req as Request & { user?: { id?: string } }).user?.id;
}

function defaultOnUnverified(_req: Request, res: Response): void {
  res.status(401).json({ error: "two_factor_required" });
}

/** Express middleware that blocks a route unless the current session has passed 2FA verification. */
export function requireTwoFactor(options: RequireTwoFactorOptions = {}): RequestHandler {
  const sessionAdapter = options.sessionAdapter ?? expressSessionAdapter();
  const getUserId = options.getUserId ?? defaultGetUserId;
  const onUnverified = options.onUnverified ?? defaultOnUnverified;

  return (req, res, next) => {
    if (!getUserId(req) || !sessionAdapter.isVerified(req)) {
      onUnverified(req, res, next);
      return;
    }
    next();
  };
}
