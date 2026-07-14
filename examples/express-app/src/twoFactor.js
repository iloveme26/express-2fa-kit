const {
  TwoFactorManager,
  InMemorySecretStore,
  InMemoryRateLimiter,
  ConsoleSmsChannel,
  ConsoleEmailChannel,
} = require("express-2fa-kit");
const { getRedisClient } = require("./storage/redisClient");
const { RedisSecretStore } = require("./storage/redisSecretStore");

const redis = getRedisClient();

// Persists to Redis (surviving restarts/redeploys) when UPSTASH_REDIS_REST_URL/TOKEN are
// set; otherwise falls back to express-2fa-kit's bundled in-memory store, so local dev
// still needs no external service. See the example README for setup.
const secretStore = redis ? new RedisSecretStore(redis) : new InMemorySecretStore();

const manager = new TwoFactorManager({
  secretStore,
  issuer: "Express 2FA Kit Example",
  rateLimiter: new InMemoryRateLimiter({ maxAttempts: 5, windowMs: 60_000, lockoutMs: 30_000 }),
  smsChannel: new ConsoleSmsChannel(),
  emailChannel: new ConsoleEmailChannel(),
});

module.exports = { manager };
