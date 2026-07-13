const express = require("express");
const { createSendChallengeHandler, createVerifyHandler, mapErrorToStatus } = require("express-2fa-kit/express");
const { manager } = require("../twoFactor");

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }
  next();
}

router.use(requireLogin);

router.post("/totp/enroll", async (req, res) => {
  try {
    const result = await manager.enrollTotp(req.session.userId, req.session.username);
    res.status(200).json(result);
  } catch (err) {
    const mapped = mapErrorToStatus(err);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/totp/confirm", async (req, res) => {
  try {
    const result = await manager.confirmTotpEnrollment(req.session.userId, req.body.code);
    res.status(200).json(result);
  } catch (err) {
    const mapped = mapErrorToStatus(err);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/sms/enroll", async (req, res) => {
  try {
    await manager.enrollSms(req.session.userId, req.body.phoneNumber);
    res.status(200).json({ ok: true });
  } catch (err) {
    const mapped = mapErrorToStatus(err);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/email/enroll", async (req, res) => {
  try {
    await manager.enrollEmail(req.session.userId, req.body.emailAddress);
    res.status(200).json({ ok: true });
  } catch (err) {
    const mapped = mapErrorToStatus(err);
    res.status(mapped.status).json(mapped.body);
  }
});

router.post("/:method/send", createSendChallengeHandler({ manager }));
router.post("/verify", createVerifyHandler({ manager }));

router.post("/disable", async (req, res) => {
  try {
    await manager.disable(req.session.userId, req.body.method);
    res.status(200).json({ ok: true });
  } catch (err) {
    const mapped = mapErrorToStatus(err);
    res.status(mapped.status).json(mapped.body);
  }
});

router.get("/status", async (req, res) => {
  const methods = await manager.listEnabledMethods(req.session.userId);
  res.status(200).json({ methods });
});

module.exports = router;
