# express-2fa-kit example app

A minimal Express app demonstrating registration, login, and all three 2FA methods
(TOTP with a QR code, SMS, and email) using `express-2fa-kit`. Runs entirely with in-memory
storage and console-logged "delivery" — no database or real SMS/email provider needed.

## Run it

From the repo root:

```sh
npm install
npm run build          # compiles express-2fa-kit to dist/, which this example depends on
npm run --workspace examples/express-app start
```

Then open http://localhost:3000.

## Try the flow

1. **Register** a user on the home page (this logs you in).
2. Go to **Set up 2FA** and enroll TOTP (scan the QR with an authenticator app, or compute a
   code from the shown secret), and/or register a phone number / email for SMS/email OTP.
   For SMS/email, click **Send code** and check the terminal running the server — the code is
   logged there instead of being sent anywhere.
3. Submit the code(s) to confirm/verify.
4. Visit **Dashboard** — it 401s until you `POST /2fa/verify` with a valid code for a confirmed
   method (do this via the enroll page's verify forms, or `curl`).
5. From the dashboard, you can disable any enrolled method.

## What this demonstrates

- `TwoFactorManager` wired with `InMemorySecretStore`, `InMemoryRateLimiter`, `ConsoleSmsChannel`,
  `ConsoleEmailChannel` ([src/twoFactor.js](src/twoFactor.js)).
- Integrating with an *existing* session-based auth system: [src/storage/users.js](src/storage/users.js)
  is a separate, ordinary user store; [src/server.js](src/server.js) bridges its session to the
  `req.user` shape `express-2fa-kit`'s middleware expects by default.
- `requireTwoFactor()` guarding a route ([src/routes/protected.js](src/routes/protected.js)).
- `createVerifyHandler`/`createSendChallengeHandler` wired into routes
  ([src/routes/twoFactor.js](src/routes/twoFactor.js)).
- A hand-rolled session middleware ([src/session.js](src/session.js)) showing that
  `expressSessionAdapter()` only needs a mutable `req.session` — not any particular session library.
