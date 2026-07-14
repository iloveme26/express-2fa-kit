# express-2fa-kit example app

A minimal Express app demonstrating registration, login, and all three 2FA methods
(TOTP with a QR code, SMS, and email) using `express-2fa-kit`. By default it runs entirely
with in-memory storage and console-logged "delivery" — no database or real SMS/email
provider needed. Optionally, it can persist accounts and 2FA state to Redis (see below),
which matters if you're deploying it somewhere without a persistent local disk (e.g.
Render's free tier) — otherwise every restart/redeploy wipes all registered users.

## Persisting across restarts (optional)

Without any setup, this app stores everything in the Node process's memory — a restart
(including a redeploy, or a free-tier host spinning down after inactivity) wipes all
registered users and 2FA enrollments. To persist across restarts:

1. Create a free database at [upstash.com](https://upstash.com) (Redis, no expiry on the free tier).
2. Copy the **REST URL** and **REST Token** from your database's dashboard.
3. Set them as environment variables wherever you run this app:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

When both are set, [src/twoFactor.js](src/twoFactor.js) and [src/storage/users.js](src/storage/users.js)
automatically switch to Redis-backed storage
([src/storage/redisSecretStore.js](src/storage/redisSecretStore.js)); otherwise they fall
back to the in-memory defaults with no code changes needed.

## Run it

From the repo root:

```sh
npm install
npm run build          # compiles express-2fa-kit to dist/, which this example depends on
npm run --workspace examples/express-app start
```

Then open http://localhost:3000.

## Try the flow

1. From the home page, click **Sign up** to register a user (this logs you in and takes you to
   **Set up 2FA**), or **Log in** if you already have one.
2. On **Set up 2FA**, enroll TOTP (scan the QR with an authenticator app, or compute a
   code from the shown secret), and/or register a phone number / email for SMS/email OTP.
   For SMS/email, click **Send code** and check the terminal running the server — the code is
   logged there instead of being sent anywhere.
3. Submit the code(s) to confirm/verify.
4. Visit **Dashboard** — it 401s until you `POST /2fa/verify` with a valid code for a confirmed
   method (do this via the enroll page's verify forms, or `curl`).
5. From the dashboard, you can disable any enrolled method.

## What this demonstrates

- `TwoFactorManager` wired with a `SecretStore` (in-memory by default, or a custom
  Redis-backed implementation when configured — see [src/storage/redisSecretStore.js](src/storage/redisSecretStore.js)
  for a worked example of implementing the interface, including the atomic attempt-counting
  the library's docs call for), `InMemoryRateLimiter`, `ConsoleSmsChannel`, `ConsoleEmailChannel`
  ([src/twoFactor.js](src/twoFactor.js)).
- Integrating with an *existing* session-based auth system: [src/storage/users.js](src/storage/users.js)
  is a separate, ordinary user store; [src/server.js](src/server.js) bridges its session to the
  `req.user` shape `express-2fa-kit`'s middleware expects by default.
- `requireTwoFactor()` guarding a route ([src/routes/protected.js](src/routes/protected.js)).
- `createVerifyHandler`/`createSendChallengeHandler` wired into routes
  ([src/routes/twoFactor.js](src/routes/twoFactor.js)).
- A hand-rolled session middleware ([src/session.js](src/session.js)) showing that
  `expressSessionAdapter()` only needs a mutable `req.session` — not any particular session library.
