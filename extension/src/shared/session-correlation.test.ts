import { describe, expect, it } from "vitest";
import { CAPTURE_LIMITS } from "./context-limits";
import {
  attachNetworkRequestCorrelation,
  enrichAndOrderRuntimeErrors,
  lastMeaningfulTimelineAnchor,
} from "./session-correlation";
import type { InteractionTimelineEntryV1, NetworkRequestSummaryEntryV1, RuntimeErrorSnapshotV1 } from "./types";

const CORR_WIN = CAPTURE_LIMITS.correlationWindowAfterActionMs;

describe("lastMeaningfulTimelineAnchor", () => {
  it("returns most recent click submit or navigate", () => {
    const tl: InteractionTimelineEntryV1[] = [
      { at: "2025-01-01T12:00:00.000Z", kind: "click", summary: "c1" },
      { at: "2025-01-01T12:00:01.000Z", kind: "input", summary: "i" },
      { at: "2025-01-01T12:00:02.000Z", kind: "navigate", summary: "nav" },
    ];
    const a = lastMeaningfulTimelineAnchor(tl);
    expect(a?.kind).toBe("navigate");
    expect(a?.summary).toBe("nav");
  });

  it("ignores input-only timelines", () => {
    const tl: InteractionTimelineEntryV1[] = [
      { at: "2025-01-01T12:00:00.000Z", kind: "input", summary: "i" },
    ];
    expect(lastMeaningfulTimelineAnchor(tl)).toBeUndefined();
  });
});

describe("attachNetworkRequestCorrelation", () => {
  const anchor = {
    at: "2025-01-01T12:00:00.000Z",
    atMs: new Date("2025-01-01T12:00:00.000Z").getTime(),
    kind: "click" as const,
    summary: "btn",
  };

  it("marks requests after anchor within window", () => {
    const list: NetworkRequestSummaryEntryV1[] = [
      {
        at: "2025-01-01T12:00:00.500Z",
        method: "GET",
        url: "https://a.test/x",
        status: 200,
        durationMs: 10,
      },
    ];
    const out = attachNetworkRequestCorrelation(list, anchor, CORR_WIN);
    expect(out[0]!.isCorrelated).toBe(true);
    expect(out[0]!.deltaToLastActionMs).toBe(500);
    expect(out[0]!.correlationTriggerKind).toBe("click");
  });

  it("does not mark requests before anchor", () => {
    const list: NetworkRequestSummaryEntryV1[] = [
      {
        at: "2025-01-01T11:59:59.000Z",
        method: "GET",
        url: "https://a.test/x",
        status: 200,
        durationMs: 10,
      },
    ];
    const out = attachNetworkRequestCorrelation(list, anchor, CORR_WIN);
    expect(out[0]!.isCorrelated).toBeUndefined();
  });
});

describe("enrichAndOrderRuntimeErrors", () => {
  const anchor = {
    at: "2025-01-01T12:00:00.000Z",
    atMs: new Date("2025-01-01T12:00:00.000Z").getTime(),
    kind: "click" as const,
    summary: "x",
  };

  it("puts higher-scored error last (principal)", () => {
    const errors: RuntimeErrorSnapshotV1[] = [
      { at: "2025-01-01T12:00:05.000Z", kind: "error", message: "late" },
      { at: "2025-01-01T12:00:00.200Z", kind: "error", message: "soon", stack: "x".repeat(40), count: 3 },
    ];
    const out = enrichAndOrderRuntimeErrors(errors, anchor, CORR_WIN);
    expect(out[out.length - 1]!.message).toBe("soon");
    expect(out[out.length - 1]!.deltaToLastActionMs).toBe(200);
  });
});
