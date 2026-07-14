const crypto = require("crypto");
const { getRedisClient } = require("./redisClient");

// Separate from express-2fa-kit's SecretStore, to demonstrate that this library plugs into
// an *existing* auth system rather than owning user accounts. Persists to Redis when
// UPSTASH_REDIS_REST_URL/TOKEN are set (see the example README); otherwise falls back to
// an in-memory Map so local dev needs no external service.
const usersByUsername = new Map();

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function userKey(username) {
  return `user:${username}`;
}

async function register(username, password) {
  const redis = getRedisClient();
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const id = crypto.randomUUID();

  if (redis) {
    const created = await redis.hsetnx(userKey(username), "id", id);
    if (!created) {
      throw new Error("A user with that username already exists.");
    }
    await redis.hset(userKey(username), { id, username, passwordHash, salt });
    return { id, username };
  }

  if (usersByUsername.has(username)) {
    throw new Error("A user with that username already exists.");
  }
  usersByUsername.set(username, { id, username, passwordHash, salt });
  return { id, username };
}

async function verifyLogin(username, password) {
  const redis = getRedisClient();
  const user = redis ? await redis.hgetall(userKey(username)) : usersByUsername.get(username);
  if (!user || !user.passwordHash) return undefined;

  const candidate = Buffer.from(hashPassword(password, user.salt));
  const stored = Buffer.from(user.passwordHash);
  if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
    return undefined;
  }
  return { id: user.id, username: user.username };
}

module.exports = { register, verifyLogin };
