const path = require("path");
const express = require("express");
const { createSessionMiddleware } = require("./session");
const authRoutes = require("./routes/auth");
const twoFactorRoutes = require("./routes/twoFactor");
const protectedRoutes = require("./routes/protected");

const app = express();
app.use(express.json());
app.use(createSessionMiddleware());

// Bridges the example's own session-based auth to the req.user duck-type that
// express-2fa-kit's middleware defaults expect.
app.use((req, res, next) => {
  if (req.session.userId) {
    req.user = { id: req.session.userId };
  }
  next();
});

app.use(express.static(path.join(__dirname, "views")));
app.use("/auth", authRoutes);
app.use("/2fa", twoFactorRoutes);
app.use(protectedRoutes);

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`express-2fa-kit example app listening on http://localhost:${port}`);
    console.log("SMS/email codes are logged to this console (mock delivery channels).");
  });
}

module.exports = { app };
