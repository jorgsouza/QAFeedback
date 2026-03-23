import { describe, expect, it } from "vitest";
import { extractClientApiKey, safeEqualString } from "./auth.js";

describe("safeEqualString", () => {
  it("returns true for equal strings", () => {
    expect(safeEqualString("abc", "abc")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(safeEqualString("abc", "abd")).toBe(false);
    expect(safeEqualString("a", "aa")).toBe(false);
  });
});

describe("extractClientApiKey", () => {
  it("reads Bearer", () => {
    expect(extractClientApiKey({ authorization: "Bearer mytoken" })).toBe("mytoken");
  });

  it("reads X-Api-Key", () => {
    expect(extractClientApiKey({ "x-api-key": "k1" })).toBe("k1");
  });

  it("returns null when missing", () => {
    expect(extractClientApiKey({})).toBeNull();
  });
});
