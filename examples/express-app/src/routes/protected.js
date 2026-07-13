const express = require("express");
const { requireTwoFactor } = require("express-2fa-kit/express");

const router = express.Router();

router.get("/dashboard", requireTwoFactor(), (req, res) => {
  res.status(200).json({ ok: true, message: `Welcome, ${req.session.username}! You are fully authenticated.` });
});

module.exports = router;
