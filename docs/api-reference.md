# API reference

## `TwoFactorManager`

```ts
new TwoFactorManager(config: TwoFactorManagerConfig)
```

| Config field   | Type                        | Required | Default |
|----------------|-----------------------------|----------|---------|
| `secretStore`  | `SecretStore`                | yes      | —       |
| `issuer`       | `string`                     | yes      | —       |
| `rateLimiter`  | `RateLimiter`                 | no       | `new InMemoryRateLimiter(rateLimit)` |
| `smsChannel`   | `SmsChannel`                  | no (required to enroll/send SMS) | — |
| `emailChannel` | `EmailChannel`                | no (required to enroll/send email) | — |
| `totp`         | `TotpOptions`                 | no       | `{ digits: 6, algorithm: "sha1", step: 30, window: 1 }` |
| `sms`          | `OtpMethodConfig`             | no       | `{ digits: 6, ttlSeconds: 600, maxAttempts: 5 }` |
| `email`        | `OtpMethodConfig`             | no       | `{ digits: 6, ttlSeconds: 600, maxAttempts: 5 }` |
| `rateLimit`    | `RateLimitConfig`             | no       | `{ maxAttempts: 5, windowMs: 60_000, lockoutMs: 60_000 }` (ignored if `rateLimiter` is set) |
| `retry`        | `RetryOptions`                | no       | `{ retries: 3, baseDelayMs: 200, maxDelayMs: 2000 }` |

### Methods

- **`enrollTotp(userId, accountName): Promise<{ otpauthUrl, qrCodeDataUrl }>`**
  Generates a fresh secret and stores it as an unconfirmed enrollment (overwrites any prior
  draft/active TOTP enrollment for this user). Returns the provisioning URI and a QR code
  (`data:image/png;base64,...`) to show the user.

- **`confirmTotpEnrollment(userId, code): Promise<{ valid: boolean }>`**
  Activates the pending TOTP enrollment. Throws `NotEnrolledError` if `enrollTotp` was never called.

- **`enrollSms(userId, phoneNumber): Promise<void>`** / **`enrollEmail(userId, emailAddress): Promise<void>`**
  Registers a destination. The method activates on the first successful `verify()`, not at enroll
  time — there's no separate "confirm" step for SMS/email, since a challenge always has to be sent
  before there's any code to check. Throws `InvalidDestinationError` on basic format validation failure.

- **`sendChallenge(userId, method): Promise<{ sent: true, expiresAt: Date }>`** (`method`: `"sms" | "email"`)
  Generates and delivers a code, retrying delivery with backoff (see `retry`). Throws `NotEnrolledError`
  if the destination isn't registered, `RateLimitedError` if the send rate is exceeded, or
  `ProviderUnavailableError` if no channel is configured or delivery fails after retries are exhausted.

- **`verify(userId, method, code, context?): Promise<VerifyOutcome>`** (`context.ip` is optional, used for
  per-IP rate limiting in addition to per-user)
  See [Error handling](#error-handling) below for the throw-vs-return contract.

- **`disable(userId, method): Promise<void>`**
  Removes the enrollment and any pending SMS/email challenge.

- **`isEnabled(userId, method): Promise<boolean>`**, **`listEnabledMethods(userId): Promise<MethodType[]>`**

### Error handling

`verify()`, `sendChallenge()`, and the enroll/confirm methods **throw** for conditions that mean the
attempt itself couldn't be evaluated — these are exceptional, not something a login form loops on:

| Error | Code | When |
|---|---|---|
| `NotEnrolledError` | `not_enrolled` | No (confirmed, for TOTP) enrollment exists for this user/method |
| `RateLimitedError` | `rate_limited` | Too many attempts; carries `retryAfterMs` |
| `ProviderUnavailableError` | `provider_unavailable` | No channel configured, or delivery failed after retries; carries `cause` |
| `InvalidDestinationError` | `invalid_destination` | Enrollment destination failed basic validation |

`verify()` **returns** `{ valid: false, reason }` for a wrong/expired/exhausted code — the normal
path a UI retries on. `reason` is one of `"invalid_code" | "expired" | "attempts_exhausted"` (TOTP
failures — including replays — always report `"invalid_code"`, since RFC 6238 doesn't distinguish
"wrong" from "replayed" at the crypto layer).

## `SecretStore`

The persistence boundary — implement this against your own database/cache. See
[providers.md](providers.md) for a worked example and the atomicity requirement on
`incrementChallengeAttempts`. `InMemorySecretStore` is the bundled reference implementation
(single-process only).

## `SmsChannel` / `EmailChannel`

Single-method delivery interfaces (`sendSms`/`sendEmail`). `ConsoleSmsChannel`/`ConsoleEmailChannel`
log to the console and are meant for development/examples/tests only.

## `RateLimiter`

`consume(key): Promise<{ allowed, retryAfterMs? }>` / `reset(key): Promise<void>`. `TwoFactorManager`
builds the keys (`verify:{userId}:{method}`, `verify-ip:{ip}:{method}`, `send:{userId}:{method}`);
implementations are dumb string-keyed counters. `InMemoryRateLimiter` is the bundled reference
implementation (fixed window + lockout, single-process only).

## Crypto primitives

Low-level RFC 4226 (HOTP) / RFC 6238 (TOTP) / RFC 4648 (base32) functions are also exported directly
(`generateHotp`, `generateTotp`, `verifyTotp`, `base32Encode`, `base32Decode`, `timingSafeEqual`) for
advanced use cases that don't need the full `TwoFactorManager` orchestration.
