import type { Request, RequestHandler } from "express";
import { TwoFactorManager } from "../core/manager";
import { mapErrorToStatus } from "./errors";

export interface CreateSendChallengeHandlerOptions {
  manager: TwoFactorManager;
  getUserId?: (req: Request) => string | undefined;
}

function defaultGetUserId(req: Request): string | undefined {
  return (req as Request & { user?: { id?: string } }).user?.id;
}

/** Builds a handler for `POST /2fa/:method/send` (method must be "sms" or "email"). */
export function createSendChallengeHandler(options: CreateSendChallengeHandlerOptions): RequestHandler {
  const getUserId = options.getUserId ?? defaultGetUserId;

  return async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const { method } = req.params;
    if (method !== "sms" && method !== "email") {
      res.status(400).json({ error: "invalid_method" });
      return;
    }

    try {
      const result = await options.manager.sendChallenge(userId, method);
      res.status(200).json({ sent: true, expiresAt: result.expiresAt.toISOString() });
    } catch (err) {
      const mapped = mapErrorToStatus(err);
      if (mapped.body.retryAfterMs !== undefined) {
        res.setHeader("Retry-After", Math.ceil(mapped.body.retryAfterMs / 1000).toString());
      }
      res.status(mapped.status).json(mapped.body);
    }
  };
}
