import { describe, expect, it } from "vitest";
import { iaOriginPatternFromBaseUrl, normalizeIaBaseUrl } from "./ia-service";

describe("normalizeIaBaseUrl", () => {
  it("returns null for empty", () => {
    expect(normalizeIaBaseUrl("")).toBeNull();
  });

  it("strips trailing slash on root", () => {
    expect(normalizeIaBaseUrl("http://127.0.0.1:8787/")).toBe("http://127.0.0.1:8787");
  });

  it("preserves path prefix", () => {
    expect(normalizeIaBaseUrl("https://api.example.com/v1/")).toBe("https://api.example.com/v1");
  });
});

describe("iaOriginPatternFromBaseUrl", () => {
  it("returns origin wildcard pattern", () => {
    expect(iaOriginPatternFromBaseUrl("https://x.com/a")).toBe("https://x.com/*");
  });
});
