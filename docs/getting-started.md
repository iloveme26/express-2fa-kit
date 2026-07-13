# Getting started

## Standalone (no Express)

`TwoFactorManager` is framework-agnostic — everything in this section works in any Node.js backend.

```ts
import { TwoFactorManager, InMemorySecretStore, ConsoleSmsChannel, ConsoleEmailChannel } from "express-2fa-kit";

const manager = new TwoFactorManager({
  secretStore: new InMemorySecretStore(),
  issuer: "My App",
  smsChannel: new ConsoleSmsChannel(),
  emailChannel: new ConsoleEmailChannel(),
});
```

`InMemorySecretStore`, `ConsoleSmsChannel`, and `ConsoleEmailChannel` are dev/test defaults — see
[providers.md](providers.md) for how to swap in real persistence and delivery.

### Enable TOTP for a user

```ts
const { otpauthUrl, qrCodeDataUrl } = await manager.enrollTotp(userId, "user@example.com");
// render qrCodeDataUrl as <img src={qrCodeDataUrl} /> for the user to scan

const { valid } = await manager.confirmTotpEnrollment(userId, codeFromAuthenticatorApp);
// once valid === true, TOTP is active for this user
```

### Enable SMS or email OTP for a user

```ts
await manager.enrollSms(userId, "+15551234567");
await manager.sendChallenge(userId, "sms"); // delivers a code via your SmsChannel

const outcome = await manager.verify(userId, "sms", codeFromUser);
// outcome.valid === true both confirms enrollment (first time) and authenticates
```

### Verify a code (login step)

```ts
const outcome = await manager.verify(userId, "totp", codeFromUser);
if (outcome.valid) {
  // mark the session/request as 2FA-verified
} else {
  // outcome.reason: "invalid_code" | "expired" | "attempts_exhausted"
}
```

`verify()` **throws** when the attempt can't be evaluated at all (not enrolled, rate limited,
delivery provider down) and **returns** `{ valid: false, reason }` for a wrong/expired/exhausted
code — see [api-reference.md](api-reference.md#error-handling) for the full list.

### Disable a method / list enabled methods

```ts
await manager.disable(userId, "sms");
const methods = await manager.listEnabledMethods(userId); // e.g. ["totp"]
```

### Account recovery

This library intentionally does not ship a recovery-code feature — recovery flows are usually tied
to your own account-support process (support-desk identity verification, backup email, etc.).
The straightforward pattern is: verify the user through your own out-of-band process, then call
`manager.disable(userId, method)` for every enrolled method to let them re-enroll from scratch.

## With Express

See [express-middleware.md](express-middleware.md) for the full middleware reference, and
[examples/express-app](../examples/express-app) for a complete, runnable app.
