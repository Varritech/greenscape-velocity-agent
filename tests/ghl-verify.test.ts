import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyGhlSignature } from "@/lib/ghl/verify";

const SECRET = "test_secret_do_not_use_in_prod";
const sign = (body: string) =>
  createHmac("sha256", SECRET).update(body).digest("hex");

describe("verifyGhlSignature", () => {
  it("accepts a correct signature", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifyGhlSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("accepts a sha256= prefixed signature", () => {
    const body = "raw body";
    expect(verifyGhlSignature(body, `sha256=${sign(body)}`, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = "original";
    const sig = sign(body);
    expect(verifyGhlSignature("tampered", sig, SECRET)).toBe(false);
  });

  it("rejects when secret is wrong", () => {
    const body = "hi";
    expect(verifyGhlSignature(body, sign(body), "wrong_secret")).toBe(false);
  });

  it("rejects missing signature header", () => {
    expect(verifyGhlSignature("x", null, SECRET)).toBe(false);
  });

  it("rejects empty secret", () => {
    expect(verifyGhlSignature("x", sign("x"), "")).toBe(false);
  });

  it("rejects non-hex garbage in signature", () => {
    expect(verifyGhlSignature("body", "not-hex-at-all", SECRET)).toBe(false);
  });

  it("rejects length-mismatched signatures without throwing", () => {
    expect(verifyGhlSignature("body", "abcd", SECRET)).toBe(false);
  });
});
