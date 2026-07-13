# Writing your own providers

This package deliberately does not bundle any SMS/email SDK or database driver — it ships small
interfaces plus in-memory/console reference implementations for development and tests. Production
apps are expected to implement these against whatever they already use.

## `SmsChannel` (e.g. Twilio)

```ts
import type { SmsChannel, SendSmsParams } from "express-2fa-kit";
import twilio from "twilio"; // npm install twilio — not a dependency of this package

export class TwilioSmsChannel implements SmsChannel {
  private readonly client: twilio.Twilio;
  constructor(private readonly accountSid: string, authToken: string, private readonly from: string) {
    this.client = twilio(accountSid, authToken);
  }

  async sendSms({ to, code, expiresInSeconds }: SendSmsParams): Promise<void> {
    await this.client.messages.create({
      to,
      from: this.from,
      body: `Your verification code is ${code}. It expires in ${Math.round(expiresInSeconds / 60)} minutes.`,
    });
  }
}
```

`TwoFactorManager` already wraps `sendSms`/`sendEmail` calls in retry-with-backoff (`retry` config) and
converts a persistent failure into `ProviderUnavailableError` — your channel implementation just needs
to throw on failure, not implement its own retry loop.

## `EmailChannel` (e.g. SendGrid)

```ts
import type { EmailChannel, SendEmailParams } from "express-2fa-kit";
import sgMail from "@sendgrid/mail"; // npm install @sendgrid/mail

export class SendGridEmailChannel implements EmailChannel {
  constructor(apiKey: string, private readonly from: string) {
    sgMail.setApiKey(apiKey);
  }

  async sendEmail({ to, code, expiresInSeconds }: SendEmailParams): Promise<void> {
    await sgMail.send({
      to,
      from: this.from,
      subject: "Your verification code",
      text: `Your code is ${code}. It expires in ${Math.round(expiresInSeconds / 60)} minutes.`,
    });
  }
}
```

## `SecretStore` (e.g. Postgres or Redis)

Implement the interface from `express-2fa-kit`'s `SecretStore` type against your schema/keyspace.
The one contract worth calling out explicitly:

> **`incrementChallengeAttempts` must be atomic.** `TwoFactorManager.verify()` calls it *before*
> checking whether the submitted code is correct, specifically so the attempt count is durable even
> under concurrent requests. `InMemorySecretStore` gets this for free from Node's single-threaded
> event loop; a real adapter must not implement it as a plain read-then-write.

Postgres sketch (using a single `otp_challenges` table keyed by `(user_id, method)`):

```sql
UPDATE otp_challenges
SET attempts = attempts + 1
WHERE user_id = $1 AND method = $2
RETURNING attempts;
```

Redis sketch (using a hash per `user_id:method`):

```ts
async incrementChallengeAttempts(userId: string, method: "sms" | "email"): Promise<number> {
  return redis.hincrby(`otp:${userId}:${method}`, "attempts", 1);
}
```

Everything else in `SecretStore` (`getEnrollment`, `saveEnrollment`, etc.) is a straightforward
read/write and doesn't need special atomicity handling.

## `RateLimiter` (e.g. Redis)

`consume(key)`/`reset(key)` map naturally onto a Redis `INCR` + `EXPIRE` (or a sliding-window
sorted-set) implementation, shared across all your app instances — unlike `InMemoryRateLimiter`,
which only protects a single process. See [deployment.md](deployment.md) for why this matters at scale.

## Why `express-2fa-kit/express` is a separate import

`TwoFactorManager` and everything under the root `express-2fa-kit` import have zero dependency on
Express, including at the type level — you can use this package in a Fastify app, a CLI, or a queue
worker with no Express types anywhere in your build. The Express-specific middleware/handlers live
behind the `express-2fa-kit/express` subpath instead of being re-exported from the root, so importing
the root package never pulls in `@types/express` for TypeScript consumers who don't use it.
