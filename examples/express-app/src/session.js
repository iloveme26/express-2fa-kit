const crypto = require("crypto");

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

/**
 * Hand-rolled cookie/Map session for this example only — no signing, rotation, or CSRF
 * protection. Real apps should use a hardened session middleware (e.g. express-session);
 * this exists purely to demonstrate that expressSessionAdapter() only needs a mutable
 * req.session object, not any particular session library.
 */
function createSessionMiddleware() {
  const sessions = new Map();

  return function sessionMiddleware(req, res, next) {
    const cookies = parseCookies(req.headers.cookie);
    let sid = cookies.sid;

    if (!sid || !sessions.has(sid)) {
      sid = crypto.randomBytes(16).toString("hex");
      sessions.set(sid, {});
      res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; Path=/; SameSite=Lax`);
    }

    req.session = sessions.get(sid);
    next();
  };
}

module.exports = { createSessionMiddleware };
