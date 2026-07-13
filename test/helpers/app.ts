import express, { Express, NextFunction, Request, Response } from "express";
import { TwoFactorManager } from "../../src/core/manager";
import { mapErrorToStatus } from "../../src/middleware/errors";
import { createSendChallengeHandler } from "../../src/middleware/sendChallengeHandler";
import { requireTwoFactor } from "../../src/middleware/requireTwoFactor";
import { createVerifyHandler } from "../../src/middleware/verifyHandler";
import { InMemoryRateLimiter } from "../../src/ratelimit/memoryRateLimiter";
import { InMemorySecretStore } from "../../src/storage/memoryStore";
import { RecordingEmailChannel, RecordingSmsChannel } from "./mockChannels";
import { createTestSessionMiddleware } from "./testSession";

export interface TestApp {
  app: Express;
  manager: TwoFactorManager;
  smsChannel: RecordingSmsChannel;
  emailChannel: RecordingEmailChannel;
}

function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.header("x-user-id");
  if (userId) {
    (req as Request & { user?: { id: string } }).user = { id: userId };
  }
  next();
}

export function createTestApp(rateLimiter?: InMemoryRateLimiter): TestApp {
  const secretStore = new InMemorySecretStore();
  const smsChannel = new RecordingSmsChannel();
  const emailChannel = new RecordingEmailChannel();
  const manager = new TwoFactorManager({
    secretStore,
    issuer: "TestApp",
    rateLimiter: rateLimiter ?? new InMemoryRateLimiter({ maxAttempts: 5, windowMs: 60_000, lockoutMs: 30_000 }),
    smsChannel,
    emailChannel,
    retry: { retries: 0 },
  });

  const app = express();
  app.use(express.json());
  app.use(createTestSessionMiddleware());
  app.use(authMiddleware);

  app.post("/2fa/totp/enroll", async (req, res) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }
    const result = await manager.enrollTotp(userId, req.body.accountName ?? userId);
    res.status(200).json(result);
  });

  app.post("/2fa/totp/confirm", async (req, res) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }
    const result = await manager.confirmTotpEnrollment(userId, req.body.code);
    res.status(200).json(result);
  });

  app.post("/2fa/sms/enroll", async (req, res) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }
    try {
      await manager.enrollSms(userId, req.body.phoneNumber);
      res.status(200).json({ ok: true });
    } catch (err) {
      const mapped = mapErrorToStatus(err);
      res.status(mapped.status).json(mapped.body);
    }
  });

  app.post("/2fa/email/enroll", async (req, res) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }
    try {
      await manager.enrollEmail(userId, req.body.emailAddress);
      res.status(200).json({ ok: true });
    } catch (err) {
      const mapped = mapErrorToStatus(err);
      res.status(mapped.status).json(mapped.body);
    }
  });

  app.post("/2fa/:method/send", createSendChallengeHandler({ manager }));
  app.post("/2fa/verify", createVerifyHandler({ manager }));
  app.get("/protected", requireTwoFactor(), (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return { app, manager, smsChannel, emailChannel };
}
