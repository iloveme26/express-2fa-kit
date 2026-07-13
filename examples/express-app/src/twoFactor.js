const {
  TwoFactorManager,
  InMemorySecretStore,
  InMemoryRateLimiter,
  ConsoleSmsChannel,
  ConsoleEmailChannel,
} = require("express-2fa-kit");

const manager = new TwoFactorManager({
  secretStore: new InMemorySecretStore(),
  issuer: "Express 2FA Kit Example",
  rateLimiter: new InMemoryRateLimiter({ maxAttempts: 5, windowMs: 60_000, lockoutMs: 30_000 }),
  smsChannel: new ConsoleSmsChannel(),
  emailChannel: new ConsoleEmailChannel(),
});

module.exports = { manager };
