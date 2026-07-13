import { generateTotp } from "../../../src/crypto/totp";
import {
  buildOtpauthUri,
  generateTotpQrCode,
  generateTotpSecret,
  verifyTotpCode,
} from "../../../src/methods/totp";

describe("generateTotpSecret", () => {
  it("defaults to 20 bytes", () => {
    expect(generateTotpSecret()).toHaveLength(20);
  });

  it("supports a custom length", () => {
    expect(generateTotpSecret(32)).toHaveLength(32);
  });

  it("produces different secrets on each call", () => {
    expect(generateTotpSecret().equals(generateTotpSecret())).toBe(false);
  });
});

describe("buildOtpauthUri", () => {
  it("builds a well-formed otpauth:// URI with encoded issuer/account and uppercase algorithm", () => {
    const secret = Buffer.from("12345678901234567890", "ascii");
    const uri = buildOtpauthUri({ secret, accountName: "jane@example.com", issuer: "Acme Co" });

    expect(uri.startsWith("otpauth://totp/Acme%20Co:jane%40example.com?")).toBe(true);

    const query = new URLSearchParams(uri.split("?")[1]);
    expect(query.get("issuer")).toBe("Acme Co");
    expect(query.get("algorithm")).toBe("SHA1");
    expect(query.get("digits")).toBe("6");
    expect(query.get("period")).toBe("30");
    expect(query.get("secret")).toBeTruthy();
  });

  it("respects custom algorithm/digits/step", () => {
    const secret = Buffer.from("12345678901234567890", "ascii");
    const uri = buildOtpauthUri({
      secret,
      accountName: "jane",
      issuer: "Acme",
      algorithm: "sha256",
      digits: 8,
      step: 60,
    });
    const query = new URLSearchParams(uri.split("?")[1]);
    expect(query.get("algorithm")).toBe("SHA256");
    expect(query.get("digits")).toBe("8");
    expect(query.get("period")).toBe("60");
  });
});

describe("generateTotpQrCode", () => {
  it("returns a PNG data URL", async () => {
    const dataUrl = await generateTotpQrCode("otpauth://totp/Acme:jane?secret=ABC&issuer=Acme");
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});

describe("verifyTotpCode", () => {
  const secret = Buffer.from("12345678901234567890", "ascii");

  it("accepts a fresh valid code", () => {
    const timestamp = 59 * 1000;
    const code = generateTotp(secret, { timestamp });
    const result = verifyTotpCode(secret, code, { timestamp });
    expect(result.valid).toBe(true);
    expect(result.matchedStep).toBe(1);
  });

  it("rejects a replayed code at or below lastAcceptedCounter", () => {
    const timestamp = 59 * 1000; // counter 1
    const code = generateTotp(secret, { timestamp });
    const result = verifyTotpCode(secret, code, { timestamp, lastAcceptedCounter: 1 });
    expect(result.valid).toBe(false);
  });

  it("accepts a code whose counter is strictly greater than lastAcceptedCounter", () => {
    const timestamp = 89 * 1000; // counter 2
    const code = generateTotp(secret, { timestamp });
    const result = verifyTotpCode(secret, code, { timestamp, lastAcceptedCounter: 1 });
    expect(result.valid).toBe(true);
    expect(result.matchedStep).toBe(2);
  });

  it("rejects an invalid code", () => {
    const result = verifyTotpCode(secret, "000000", { timestamp: 59 * 1000 });
    expect(result.valid).toBe(false);
  });
});
