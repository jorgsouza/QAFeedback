import { describe, expect, it } from "vitest";
import { applyCaptureModeToContext, normalizeCaptureMode } from "./capture-mode";
import type { CapturedIssueContextV1 } from "./types";

const minimalCtx = (): CapturedIssueContextV1 => ({
  version: 1,
  page: {
    url: "https://exemplo.app/x",
    pathname: "/x",
    routeSearch: "?a=1",
    routeSlug: "ra-x",
    routeLabel: "X",
    routeKey: "other",
    title: "Título bem longo ".repeat(10),
    userAgent: "Mozilla/5.0 ".repeat(20),
    timestamp: "2025-01-01T00:00:00.000Z",
    viewport: "800x600",
    screenCss: "800x600",
    devicePixelRatio: "1",
    maxTouchPoints: 0,
    pointerCoarse: false,
    viewModeHint: "desktop",
  },
  console: [{ level: "log", message: "x".repeat(300) }],
  failedRequests: [],
  networkRequestSummaries: [
    {
      at: "2025-01-01T12:00:00.000Z",
      method: "GET",
      url: "https://exemplo.app/api",
      status: 200,
      durationMs: 10,
      requestId: "req-secret",
      correlationId: "corr-secret",
      statusText: "long status ".repeat(5),
    },
  ],
  runtimeErrors: [
    {
      at: "2025-01-01T12:00:01.000Z",
      kind: "error",
      message: "err ".repeat(80),
      stack: "stack ".repeat(40),
      file: "app.js",
      line: 1,
      col: 1,
    },
  ],
  interactionTimeline: [{ at: "2025-01-01T12:00:00.000Z", kind: "click", summary: "s ".repeat(50) }],
});

describe("normalizeCaptureMode", () => {
  it("defaults to debug-interno", () => {
    expect(normalizeCaptureMode(undefined)).toBe("debug-interno");
    expect(normalizeCaptureMode("")).toBe("debug-interno");
    expect(normalizeCaptureMode("other")).toBe("debug-interno");
  });
  it("accepts producao-sensivel", () => {
    expect(normalizeCaptureMode("producao-sensivel")).toBe("producao-sensivel");
  });
});

describe("applyCaptureModeToContext", () => {
  it("tags debug without shrinking", () => {
    const ctx = minimalCtx();
    const out = applyCaptureModeToContext(ctx, "debug-interno");
    expect(out.captureMode).toBe("debug-interno");
    expect(out.console[0].message.length).toBeGreaterThan(200);
    expect(out.networkRequestSummaries?.[0].requestId).toBe("req-secret");
    expect(out.runtimeErrors?.[0].stack).toBeTruthy();
  });

  it("tightens payload in producao-sensivel", () => {
    const ctx = minimalCtx();
    const out = applyCaptureModeToContext(ctx, "producao-sensivel");
    expect(out.captureMode).toBe("producao-sensivel");
    expect(out.page.title.length).toBeLessThan(ctx.page.title.length);
    expect(out.console[0].message.length).toBeLessThanOrEqual(180);
    expect(out.networkRequestSummaries?.[0].requestId).toBeUndefined();
    expect(out.networkRequestSummaries?.[0].correlationId).toBeUndefined();
    expect(out.runtimeErrors?.[0].stack).toBeUndefined();
    expect(out.runtimeErrors?.[0].file).toBeUndefined();
  });
});
