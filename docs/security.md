# Security & threat model

## In scope — what this library defends against

- **Timing attacks on code comparison.** All code comparisons go through `timingSafeEqual`
  (crypto/timingSafeEqual.ts), which hashes both inputs to a fixed-length digest before
  `crypto.timingSafeEqual`, so length differences can't leak information via timing or exceptions.

- **TOTP replay.** A captured/observed TOTP code is only valid once: `TwoFactorManager` persists the
  highest accepted time-step counter (`lastAcceptedCounter`) per user and rejects any code at or
  below it, even though RFC 6238's clock-skew window would otherwise accept it again.

- **SMS/email code replay and guessing.** Codes are single-use (the challenge is deleted on success),
  time-limited (`ttlSeconds`, default 600s/10min), and attempt-limited (`maxAttempts`, default 5) —
  enforced via an atomically-incremented attempt counter (see [providers.md](providers.md)) so
  concurrent requests can't bypass the limit.

- **Codes at rest.** SMS/email codes are stored as a SHA-256 hash (`codeHash`), never plaintext — a
  compromised `SecretStore` doesn't hand an attacker usable codes directly (though see "out of
  scope" below regarding TOTP secrets specifically).

- **Brute force.** `RateLimiter` is applied inside `TwoFactorManager.verify()` and `sendChallenge()`
  themselves, not just at the HTTP/middleware layer — so rate limiting applies identically whether
  you're using the Express middleware, a custom route, or calling `TwoFactorManager` directly from a
  non-HTTP context. Limits are keyed per user and (optionally) per IP.

- **Clock skew.** TOTP verification checks a configurable window of adjacent time steps
  (`window`, default ±1 step / ±30s) so minor client/server clock drift doesn't cause false rejections.

## Out of scope — explicitly not handled by this library

- **TOTP secret encryption at rest.** `SecretStore.saveEnrollment` receives the raw secret bytes;
  whether/how you encrypt them in your database (e.g. envelope encryption via KMS) is the
  `SecretStore` implementer's responsibility, not this library's.

- **Phishing / real-time relay attacks.** No TOTP or OTP-code scheme (this library included) can
  prevent a user from being tricked into typing a valid code into an attacker-controlled proxy in
  real time. If this is in your threat model, look at phishing-resistant methods (WebAuthn/FIDO2)
  as a complement, not a replacement, for what's here.

- **Session fixation / hijacking.** `express-2fa-kit` marks an *existing* session as 2FA-verified; it
  does not create, rotate, or secure the session itself. Use a properly configured session
  middleware (secure, httpOnly, signed cookies; session rotation on privilege change).

- **SMS/email account takeover of the delivery channel itself** (SIM-swapping, compromised email
  account). This is an inherent limitation of SMS/email OTP as a factor, not something a delivery
  wrapper can mitigate — TOTP does not share this weakness and is the recommended primary method
  where feasible.

- **Multi-process rate limiting / secret storage correctness.** The bundled `InMemoryRateLimiter`
  and `InMemorySecretStore` are single-process only (see [deployment.md](deployment.md)) — running
  multiple instances without a shared backing store means brute-force protection and enrollment
  state are only enforced per-instance, not globally.

## HTTPS assumption

TOTP secrets and OTP codes must never be transmitted over plaintext HTTP. `enrollTotp()`'s returned
`otpauthUrl`/`qrCodeDataUrl` and every OTP code delivered via `sendChallenge()` are only as safe as
the transport they travel over — always serve your app over HTTPS in production. This library does
not enforce transport security itself (that's your reverse proxy/hosting layer's job) but assumes it.
