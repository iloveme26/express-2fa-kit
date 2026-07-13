import { timingSafeEqual } from "../../../src/crypto/timingSafeEqual";

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("123456", "123456")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeEqual("123456", "654321")).toBe(false);
  });

  it("returns false for strings of different lengths without throwing", () => {
    expect(() => timingSafeEqual("123", "1234567")).not.toThrow();
    expect(timingSafeEqual("123", "1234567")).toBe(false);
  });

  it("returns false when comparing against an empty string", () => {
    expect(timingSafeEqual("123456", "")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });
});
