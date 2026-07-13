const express = require("express");
const { register, verifyLogin } = require("../storage/users");

const router = express.Router();

router.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  try {
    const user = register(username, password);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.status(200).json({ ok: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = verifyLogin(username, password);
  if (!user) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.status(200).json({ ok: true, user });
});

router.post("/logout", (req, res) => {
  delete req.session.userId;
  delete req.session.username;
  delete req.session.twoFactor;
  res.status(200).json({ ok: true });
});

router.get("/me", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  res.status(200).json({ userId: req.session.userId, username: req.session.username });
});

module.exports = router;
