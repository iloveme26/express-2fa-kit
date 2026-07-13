import { base32Encode, base32Decode } from "../../../src/crypto/base32";

describe("base32Encode", () => {
  // RFC 4648 test vectors (section 10)
  const vectors: [string, string][] = [
    ["", ""],
    ["f", "MY======"],
    ["fo", "MZXQ===="],
    ["foo", "MZXW6==="],
    ["foob", "MZXW6YQ="],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI======"],
  ];

  it.each(vectors)("encodes %j as %j", (input, expected) => {
    expect(base32Encode(Buffer.from(input, "ascii"))).toBe(expected);
  });
});

describe("base32Decode", () => {
  const vectors: [string, string][] = [
    ["", ""],
    ["MY======", "f"],
    ["MZXQ====", "fo"],
    ["MZXW6===", "foo"],
    ["MZXW6YQ=", "foob"],
    ["MZXW6YTB", "fooba"],
    ["MZXW6YTBOI======", "foobar"],
  ];

  it.each(vectors)("decodes %j as %j", (input, expected) => {
    expect(base32Decode(input).toString("ascii")).toBe(expected);
  });

  it("accepts lowercase input", () => {
    expect(base32Decode("mzxw6ytboi======").toString("ascii")).toBe("foobar");
  });

  it("accepts input missing padding", () => {
    expect(base32Decode("MZXW6YTBOI").toString("ascii")).toBe("foobar");
  });

  it("strips hyphens and spaces", () => {
    expect(base32Decode("MZXW-6YTB OI======").toString("ascii")).toBe("foobar");
  });

  it("throws on an invalid character", () => {
    expect(() => base32Decode("MZXW6YTB1!")).toThrow(/Invalid base32 character/);
  });
});

describe("base32 round trip", () => {
  it("recovers arbitrary byte buffers", () => {
    for (const bytes of [1, 5, 10, 16, 20, 32]) {
      const buf = Buffer.from(Array.from({ length: bytes }, (_, i) => (i * 37) % 256));
      expect(base32Decode(base32Encode(buf))).toEqual(buf);
    }
  });
});
