import type { NextFunction, Request, RequestHandler, Response } from "express";

type RequestWithSession = Request & { session?: Record<string, unknown> };

/**
 * Minimal req.session attacher for integration tests — no cookies, no express-session
 * dependency. Tests select which "session" they're in via the `x-session-id` header,
 * which is enough to exercise the default expressSessionAdapter() end to end.
 */
export function createTestSessionMiddleware(): RequestHandler {
  const sessions = new Map<string, Record<string, unknown>>();

  return (req: Request, _res: Response, next: NextFunction) => {
    const sessionId = req.header("x-session-id") ?? "default";
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {});
    }
    (req as RequestWithSession).session = sessions.get(sessionId);
    next();
  };
}
