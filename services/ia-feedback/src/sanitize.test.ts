import { describe, expect, it } from "vitest";
import {
  sanitizeWhatHappened,
  serializeTechnicalContext,
  stripSensitivePatterns,
  truncate,
} from "./sanitize.js";

describe("stripSensitivePatterns", () => {
  it("redacts Bearer tokens", () => {
    expect(stripSensitivePatterns('auth: Bearer abc.def.ghi')).toContain("[redacted]");
    expect(stripSensitivePatterns('auth: Bearer abc.def.ghi')).not.toContain("abc.def");
  });

  it("redacts password= query pairs", () => {
    expect(stripSensitivePatterns("x?password=secret123&y=1")).toMatch(/password=\[redacted\]/i);
  });
});

describe("truncate", () => {
  it("adds ellipsis when over max", () => {
    expect(truncate("1234567890", 5)).toBe("1234…");
  });
});

describe("sanitizeWhatHappened", () => {
  it("combines strip and truncate", () => {
    const long = "a".repeat(100);
    expect(sanitizeWhatHappened(long, 20).length).toBeLessThanOrEqual(20);
  });
});

describe("serializeTechnicalContext", () => {
  it("stringifies objects", () => {
    const s = serializeTechnicalContext({ url: "https://x" }, 500);
    expect(s).toContain("https://x");
  });
});
