# express-2fa-kit

Provider-agnostic Two-Factor Authentication (TOTP, SMS OTP, Email OTP) toolkit for Node.js and Express.

- **Framework-agnostic core** — `TwoFactorManager` has zero dependency on Express and works in any Node.js backend.
- **Pluggable everywhere** — bring your own secret storage, SMS/email delivery, and rate limiter, or use the in-memory/console defaults to get started in minutes.
- **Express-ready** — middleware and route-handler factories for `requireTwoFactor`, verify, and send-code endpoints, importable from `express-2fa-kit/express`.
- **Secure by default** — constant-time code comparison, TOTP replay protection, brute-force rate limiting, and never persists a plaintext OTP code.

## Install

```sh
npm install express-2fa-kit
```

Express is an optional peer dependency — only required if you use `express-2fa-kit/express`.

## Quickstart (standalone)

```ts
import { TwoFactorManager, InMemorySecretStore, ConsoleSmsChannel, ConsoleEmailChannel } from "express-2fa-kit";

const manager = new TwoFactorManager({
  secretStore: new InMemorySecretStore(), // swap for your own DB/Redis-backed SecretStore in production
  issuer: "My App",
  smsChannel: new ConsoleSmsChannel(),     // swap for Twilio, SNS, etc. — see docs/providers.md
  emailChannel: new ConsoleEmailChannel(), // swap for SendGrid, SES, etc.
});

// 1. Enroll TOTP — show the QR code to the user
const { otpauthUrl, qrCodeDataUrl } = await manager.enrollTotp(userId, "user@example.com");

// 2. Confirm with a code from their authenticator app
const { valid } = await manager.confirmTotpEnrollment(userId, codeFromApp);

// 3. Later, verify a login attempt
const outcome = await manager.verify(userId, "totp", codeFromApp);
```

## Quickstart (Express)

```ts
import express from "express";
import { requireTwoFactor, createVerifyHandler, createSendChallengeHandler } from "express-2fa-kit/express";
import { manager } from "./twoFactor";

const app = express();
app.use(express.json());

app.post("/2fa/:method/send", createSendChallengeHandler({ manager }));
app.post("/2fa/verify", createVerifyHandler({ manager }));
app.get("/dashboard", requireTwoFactor(), (req, res) => res.send("Welcome!"));
```

## Docs

- [Getting started](docs/getting-started.md)
- [API reference](docs/api-reference.md)
- [Express middleware](docs/express-middleware.md)
- [Writing your own providers](docs/providers.md) (SMS/email channels, SecretStore, rate limiter)
- [Security & threat model](docs/security.md)
- [Deployment notes](docs/deployment.md)
- [Example Express app](examples/express-app)

## License

MIT — see [LICENSE](LICENSE).
