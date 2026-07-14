const { Redis } = require("@upstash/redis");

let client;
let attempted = false;

/** Returns a shared Upstash Redis client, or null if the env vars aren't set (local dev default). */
function getRedisClient() {
  if (attempted) return client;
  attempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  client = new Redis({ url, token });
  return client;
}

module.exports = { getRedisClient };
