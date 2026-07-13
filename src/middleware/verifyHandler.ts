import type { Request, RequestHandler } from "express";
import { TwoFactorManager } from "../core/manager";
import { MethodType } from "../storage/types";
import { mapErrorToStatus } from "./errors";
import { expressSessionAdapter, SessionAdapter } from "./session";

export interface CreateVerifyHandlerOptions {
  manager: TwoFactorManager;
  sessionAdapter?: SessionAdapter;
  getUserId?: (req: Request) => string | undefined;
  /** Default: `req.ip`. Passed through to TwoFactorManager.verify() for per-IP rate limiting. */
  getIp?: (req: Request) => string | undefined;
}

function defaultGetUserId(req: Request): string | undefined {
  return (req as Request & { user?: { id?: string } }).user?.id;
}

function defaultGetIp(req: Request): string | undefined {
  return req.ip;
}

/** Builds a POST handler that reads `{ method, code }` from the body and verifies it. */
export function createVerifyHandler(options: CreateVerifyHandlerOptions): RequestHandler {
  const sessionAdapter = options.sessionAdapter ?? expressSessionAdapter();
  const getUserId = options.getUserId ?? defaultGetUserId;
  const getIp = options.getIp ?? defaultGetIp;

  return async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const { method, code } = (req.body ?? {}) as { method?: MethodType; code?: string };
    if (!method || !code) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }

    try {
      const outcome = await options.manager.verify(userId, method, code, { ip: getIp(req) });
      if (outcome.valid) {
        sessionAdapter.markVerified(req, method);
      }
      res.status(200).json(outcome);
    } catch (err) {
      const mapped = mapErrorToStatus(err);
      if (mapped.body.retryAfterMs !== undefined) {
        res.setHeader("Retry-After", Math.ceil(mapped.body.retryAfterMs / 1000).toString());
      }
      res.status(mapped.status).json(mapped.body);
    }
  };
}
