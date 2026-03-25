import { describe, expect, it } from "vitest";
import { CAPTURE_LIMITS } from "./context-limits";
import type { CapturedIssueContextV1 } from "./types";

const minimalPage = {
  url: "https://exemplo.test/p",
  pathname: "/p",
  routeSearch: "",
  routeSlug: "ra-p",
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
  viewModeHint: "hint",
};

describe("CapturedIssueContextV1", () => {
  it("round-trips JSON with version 1", () => {
    const ctx: CapturedIssueContextV1 = {
      version: 1,
      page: minimalPage,
      console: [],
      failedRequests: [],
    };
    const parsed = JSON.parse(JSON.stringify(ctx)) as CapturedIssueContextV1;
    expect(parsed.version).toBe(1);
    expect(parsed.page.pathname).toBe("/p");
  });

  it("keeps serialized payload bounded when console is at cap with long messages", () => {
    const longMsg = "x".repeat(400);
    const ctx: CapturedIssueContextV1 = {
      version: 1,
      page: minimalPage,
      console: Array.from({ length: CAPTURE_LIMITS.issueConsoleEntries }, () => ({
        level: "log" as const,
        message: longMsg,
      })),
      failedRequests: [],
    };
    expect(JSON.stringify(ctx).length).toBeLessThan(12_000);
  });
});
