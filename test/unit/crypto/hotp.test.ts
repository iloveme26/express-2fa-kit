import { generateHotp } from "../../../src/crypto/hotp";

// RFC 4226 Appendix D test vectors.
const secret = Buffer.from("12345678901234567890", "ascii");

const rfcVectors: [number, string][] = [
  [0, "755224"],
  [1, "287082"],
  [2, "359152"],
  [3, "969429"],
  [4, "338314"],
  [5, "254676"],
  [6, "287922"],
  [7, "162583"],
  [8, "399871"],
  [9, "520489"],
];

describe("generateHotp", () => {
  it.each(rfcVectors)("counter %i produces %s (RFC 4226 Appendix D)", (counter, expected) => {
    expect(generateHotp(secret, counter)).toBe(expected);
  });

  it("accepts a bigint counter", () => {
    expect(generateHotp(secret, 0n)).toBe("755224");
  });

  it("pads short codes with leading zeros", () => {
    for (const [counter, expected] of rfcVectors) {
      const code = generateHotp(secret, counter);
      expect(code).toHaveLength(6);
      expect(code).toBe(expected);
    }
  });

  it("supports a custom digit count", () => {
    const code = generateHotp(secret, 0, { digits: 8 });
    expect(code).toHaveLength(8);
    expect(code.endsWith("755224")).toBe(true);
  });

  it("supports sha256 and sha512 algorithms and produces different codes than sha1", () => {
    const sha1 = generateHotp(secret, 0, { algorithm: "sha1" });
    const sha256 = generateHotp(secret, 0, { algorithm: "sha256" });
    const sha512 = generateHotp(secret, 0, { algorithm: "sha512" });
    expect(sha256).not.toBe(sha1);
    expect(sha512).not.toBe(sha1);
    expect(sha256).not.toBe(sha512);
  });
});
