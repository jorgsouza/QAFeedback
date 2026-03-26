import { describe, expect, it } from "vitest";
import {
  appendEntriesToSession,
  emptyTimelineSession,
  expireTimelineSessionIfStale,
  mergeSessionAndBridgeTimelines,
  mergeTimelineEntryLists,
  parseTimelineTabSession,
  timelineEntryFingerprint,
} from "./timeline-session-store";

describe("timelineEntryFingerprint", () => {
  it("is stable for same second", () => {
    const a = { at: "2026-03-26T12:00:00.100Z", kind: "click" as const, summary: "btn" };
    const b = { at: "2026-03-26T12:00:00.900Z", kind: "click" as const, summary: "btn" };
    expect(timelineEntryFingerprint(a)).toBe(timelineEntryFingerprint(b));
  });

  it("differs across seconds", () => {
    const a = { at: "2026-03-26T12:00:00.000Z", kind: "click" as const, summary: "btn" };
    const b = { at: "2026-03-26T12:00:01.000Z", kind: "click" as const, summary: "btn" };
    expect(timelineEntryFingerprint(a)).not.toBe(timelineEntryFingerprint(b));
  });
});

describe("mergeTimelineEntryLists", () => {
  it("dedupes and sorts", () => {
    const a = [{ at: "2026-01-01T12:00:02.000Z", kind: "click" as const, summary: "x" }];
    const b = [
      { at: "2026-01-01T12:00:01.000Z", kind: "navigate" as const, summary: "/" },
      { at: "2026-01-01T12:00:02.000Z", kind: "click" as const, summary: "x" },
    ];
    const m = mergeTimelineEntryLists(a, b, 10);
    expect(m.map((e) => e.kind)).toEqual(["navigate", "click"]);
    expect(m).toHaveLength(2);
  });

  it("caps", () => {
    const xs = Array.from({ length: 5 }, (_, i) => ({
      at: `2026-01-01T12:00:0${i}.000Z`,
      kind: "click" as const,
      summary: `s${i}`,
    }));
    const m = mergeTimelineEntryLists([], xs, 3);
    expect(m).toHaveLength(3);
    expect(m[2]!.summary).toBe("s4");
  });
});

describe("expireTimelineSessionIfStale", () => {
  it("clears entries when stale", () => {
    const old = new Date(Date.now() - 3_600_000).toISOString();
    const s = {
      sessionId: "x",
      startedAt: old,
      updatedAt: old,
      entries: [{ at: old, kind: "click" as const, summary: "a" }],
    };
    const out = expireTimelineSessionIfStale(s, Date.now(), 60_000);
    expect(out.entries).toHaveLength(0);
    expect(out.sessionId).toBe("x");
  });
});

describe("appendEntriesToSession", () => {
  it("merges into session", () => {
    const t0 = emptyTimelineSession("2026-01-01T00:00:00.000Z");
    const next = appendEntriesToSession(
      t0,
      [{ at: "2026-01-01T00:00:01.000Z", kind: "click" as const, summary: "ok" }],
      "2026-01-01T00:00:01.000Z",
      100,
    );
    expect(next.entries).toHaveLength(1);
  });
});

describe("mergeSessionAndBridgeTimelines", () => {
  it("uses only bridge when session empty", () => {
    const b = [{ at: "2026-01-01T00:00:00.000Z", kind: "click" as const, summary: "b" }];
    expect(mergeSessionAndBridgeTimelines(undefined, b, 10)).toEqual(b);
  });
});

describe("parseTimelineTabSession", () => {
  it("parses valid payload", () => {
    const p = parseTimelineTabSession({
      sessionId: "s",
      startedAt: "a",
      updatedAt: "b",
      entries: [{ at: "c", kind: "click", summary: "d" }],
    });
    expect(p?.entries).toHaveLength(1);
  });

  it("rejects invalid", () => {
    expect(parseTimelineTabSession(null)).toBeNull();
    expect(parseTimelineTabSession({})).toBeNull();
  });
});
