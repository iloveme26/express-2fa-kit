# Deployment notes

## The bundled in-memory adapters are single-process only

`InMemorySecretStore` and `InMemoryRateLimiter` are reference implementations meant for local
development, examples, and tests. They store all state in a process-local `Map` — meaning:

- Restarting the process discards all enrollments, pending challenges, and rate-limit state.
- Running more than one instance (multiple dynos/pods/workers) means each instance has its own
  independent view of the world — a user could enroll on instance A and fail to verify on instance B.

Before deploying to production with more than one process, replace both with implementations backed
by a shared store (Postgres/MySQL/a KV store for `SecretStore`, Redis for `RateLimiter`) — see
[providers.md](providers.md) for adapter sketches of each.

## Graceful degradation when a delivery provider is down

`TwoFactorManager.sendChallenge()` retries delivery with exponential backoff (configurable via the
`retry` option) before giving up with a `ProviderUnavailableError`. This library does not build in
automatic fallback to a different method — that's an application-level product decision. Two
reasonable patterns, depending on what you've enrolled:

- **Fall back to TOTP**, if the user has it enrolled, when SMS/email delivery is failing — TOTP
  needs no delivery channel at all, so it's unaffected by an SMS/email provider outage.
- **Queue for manual/delayed retry** and surface a clear "we couldn't send your code, try again in a
  moment" message, rather than silently retrying forever or locking the user out.

Catch `ProviderUnavailableError` specifically (its `cause` carries the underlying delivery error) to
implement whichever pattern fits your product.

## Scaling the QR code endpoint

`generateTotpQrCode` renders a PNG synchronously via the `qrcode` package on every `enrollTotp()`
call — this is CPU-bound but fast (single-digit milliseconds) and doesn't need special handling at
typical enrollment volumes. If TOTP enrollment becomes a very hot path, cache the QR code alongside
the pending enrollment rather than regenerating it, but this is not necessary for most applications.
