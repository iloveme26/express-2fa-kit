# Express middleware

Import from the `express-2fa-kit/express` subpath — kept separate from the root package so that
consumers who only use `TwoFactorManager` standalone never need `@types/express` resolvable
(see [providers.md](providers.md) if you're curious why that split exists).

```ts
import {
  requireTwoFactor,
  createVerifyHandler,
  createSendChallengeHandler,
  expressSessionAdapter,
  mapErrorToStatus,
} from "express-2fa-kit/express";
```

## `SessionAdapter`

Bridges "is this session 2FA-verified" state to whatever session mechanism your app uses:

```ts
interface SessionAdapter {
  isVerified(req: Request): boolean;
  markVerified(req: Request, method: MethodType): void;
  clearVerified(req: Request): void;
}
```

The default, `expressSessionAdapter({ sessionKey? })`, only requires a mutable `req.session` object
— it works with `express-session`, `cookie-session`, or a hand-rolled equivalent. It throws a clear
error (rather than silently no-op-ing) if `req.session` isn't set when it's used, so a missing
session middleware fails loudly instead of pretending every request is unverified.

If your app doesn't use `req.session` at all (e.g. you track verification in a JWT claim), implement
`SessionAdapter` yourself and pass it to every factory below via `sessionAdapter`.

## `requireTwoFactor(options?)`

Express middleware that blocks a route unless the current session has passed 2FA verification.

```ts
app.get("/dashboard", requireTwoFactor(), (req, res) => { ... });
```

| Option | Default |
|---|---|
| `sessionAdapter` | `expressSessionAdapter()` |
| `getUserId` | `(req) => req.user?.id` (duck-typed — no auth-library dependency) |
| `onUnverified` | responds `401 { error: "two_factor_required" }` |

## `createVerifyHandler({ manager, sessionAdapter?, getUserId?, getIp? })`

Builds a `POST` handler reading `{ method, code }` from the request body, calling
`manager.verify(...)`, and — on `valid: true` — marking the session verified via `sessionAdapter`.
Errors are mapped to HTTP status codes via `mapErrorToStatus` (a `RateLimitedError` also sets a
`Retry-After` header).

```ts
app.post("/2fa/verify", createVerifyHandler({ manager }));
```

## `createSendChallengeHandler({ manager, getUserId? })`

Builds a handler for `POST /2fa/:method/send` (`:method` must be `"sms"` or `"email"`), calling
`manager.sendChallenge(...)`.

```ts
app.post("/2fa/:method/send", createSendChallengeHandler({ manager }));
```

## `mapErrorToStatus(err)`

Used internally by both handler factories; exported so you can build custom routes with the same
error-to-status mapping (`NotEnrolledError`/`InvalidDestinationError` → 400, `RateLimitedError` → 429,
`ProviderUnavailableError` → 503).

## A complete example

See [examples/express-app](../examples/express-app) for a full app wiring registration, login,
TOTP enrollment with a rendered QR code, SMS/email enrollment with console-logged codes, a protected
route, and disable — all runnable locally with no external services.
