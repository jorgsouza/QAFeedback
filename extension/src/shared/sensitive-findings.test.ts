import { describe, expect, it } from "vitest";
import { detectSensitiveFindings, fingerprintForSnippet, maskSensitivePreview } from "./sensitive-findings";
import type { TechnicalContextPayload } from "./types";

const basePage = {
  url: "https://app.example.com/path",
  pathname: "/path",
  routeSearch: "",
  routeSlug: "ra-path",
  routeLabel: "P",
  routeKey: "other",
  title: "T",
  userAgent: "UA",
  timestamp: "2025-01-01T00:00:00.000Z",
  viewport: "800x600",
  screenCss: "800x600",
  devicePixelRatio: "1",
  maxTouchPoints: 0,
  pointerCoarse: false,
  viewModeHint: "desktop",
};

function ctx(p: Partial<TechnicalContextPayload>): TechnicalContextPayload {
  const { page: pageOverride, ...rest } = p;
  return {
    page: pageOverride ?? basePage,
    console: [],
    failedRequests: [],
    ...rest,
  };
}

describe("maskSensitivePreview / fingerprintForSnippet", () => {
  it("shortens long secrets", () => {
    const long = "1234567890abcdefghij";
    expect(maskSensitivePreview(long, 48).length).toBeLessThanOrEqual(48);
    expect(maskSensitivePreview(long)).toContain("…");
  });

  it("fingerprint is stable for same snippet", () => {
    expect(fingerprintForSnippet("abc")).toBe(fingerprintForSnippet("abc"));
    expect(fingerprintForSnippet("abc")).not.toBe(fingerprintForSnippet("abd"));
  });
});

describe("detectSensitiveFindings", () => {
  it("returns empty when nothing suspicious", () => {
    expect(detectSensitiveFindings(ctx({ console: [{ level: "log", message: "ok" }] }))).toEqual([]);
  });

  it("detects JWT-like string in console", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature";
    const out = detectSensitiveFindings(
      ctx({ console: [{ level: "log", message: `token=${jwt}` }] }),
    );
    expect(out.some((f) => f.kind === "secret_or_token")).toBe(true);
    expect(out[0].samplePreview.length).toBeLessThan(jwt.length);
    expect(out[0].summary.toLowerCase()).toContain("jwt");
  });

  it("detects Bearer in console", () => {
    const out = detectSensitiveFindings(
      ctx({ console: [{ level: "warn", message: 'Authorization: Bearer abcdefghijklmnop' }] }),
    );
    expect(out.some((f) => f.kind === "secret_or_token" && f.source === "console")).toBe(true);
  });

  it("detects email as PII", () => {
    const out = detectSensitiveFindings(
      ctx({ console: [{ level: "log", message: "user qa@example.com logged" }] }),
    );
    expect(out.some((f) => f.kind === "pii")).toBe(true);
  });

  it("detects CPF-like pattern", () => {
    const out = detectSensitiveFindings(
      ctx({ console: [{ level: "log", message: "doc 123.456.789-00 here" }] }),
    );
    expect(out.some((f) => f.kind === "pii" && f.severity === "medium")).toBe(true);
  });

  it("detects SQL-ish runtime message with low confidence injection hint", () => {
    const out = detectSensitiveFindings(
      ctx({
        console: [],
        runtimeErrors: [
          {
            at: "2025-01-01T00:00:00.000Z",
            kind: "error",
            message: "syntax error near SELECT",
          },
        ],
      }),
    );
    const inj = out.filter((f) => f.kind === "injection_hint");
    expect(inj.length).toBeGreaterThan(0);
    expect(inj[0].confidence).toBe("low");
  });

  it("detects mixed content hint on HTTPS page", () => {
    const out = detectSensitiveFindings(
      ctx({
        console: [{ level: "log", message: "loaded http://cdn.example.com/x.js" }],
      }),
    );
    expect(out.some((f) => f.kind === "mixed_content")).toBe(true);
  });

  it("does not flag localhost http on HTTPS", () => {
    const out = detectSensitiveFindings(
      ctx({
        console: [{ level: "log", message: "proxy http://localhost:8080/x" }],
      }),
    );
    expect(out.some((f) => f.kind === "mixed_content")).toBe(false);
  });

  it("dedupes repeated same snippet", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.sig";
    const out = detectSensitiveFindings(
      ctx({
        console: [
          { level: "log", message: jwt },
          { level: "warn", message: jwt },
        ],
      }),
    );
    const secrets = out.filter((f) => f.kind === "secret_or_token");
    expect(secrets.length).toBe(1);
  });
});
