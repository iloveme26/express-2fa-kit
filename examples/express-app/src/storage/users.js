const crypto = require("crypto");

// Trivial in-memory user store — separate from express-2fa-kit's SecretStore, to demonstrate
// that this library plugs into an *existing* auth system rather than owning user accounts.
const usersByUsername = new Map();

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function register(username, password) {
  if (usersByUsername.has(username)) {
    throw new Error("A user with that username already exists.");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const user = { id: crypto.randomUUID(), username, passwordHash, salt };
  usersByUsername.set(username, user);
  return { id: user.id, username: user.username };
}

function verifyLogin(username, password) {
  const user = usersByUsername.get(username);
  if (!user) return undefined;
  const candidate = Buffer.from(hashPassword(password, user.salt));
  const stored = Buffer.from(user.passwordHash);
  if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
    return undefined;
  }
  return { id: user.id, username: user.username };
}

module.exports = { register, verifyLogin };
