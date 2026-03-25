import { describe, expect, it } from "vitest";
import type { NetworkRequestSummaryEntryV1 } from "./types";
import { pickNetworkSummariesForIssue, summariesToFailedRequests } from "./network-summary";

function e(
  partial: Partial<NetworkRequestSummaryEntryV1> & Pick<NetworkRequestSummaryEntryV1, "method" | "url" | "status" | "durationMs">,
): NetworkRequestSummaryEntryV1 {
  return {
    ...partial,
    at: partial.at ?? "2025-01-01T12:00:00.000Z",
    method: partial.method,
    url: partial.url,
    status: partial.status,
    durationMs: partial.durationMs,
  };
}

describe("pickNetworkSummariesForIssue", () => {
  it("prioritizes errors over slow over ok", () => {
    const list = [
      e({ method: "GET", url: "https://a.test/x", status: 200, durationMs: 100, at: "2025-01-01T12:00:03.000Z" }),
      e({ method: "GET", url: "https://a.test/y", status: 500, durationMs: 50, at: "2025-01-01T12:00:02.000Z" }),
      e({ method: "GET", url: "https://a.test/z", status: 200, durationMs: 4000, at: "2025-01-01T12:00:01.000Z" }),
    ];
    const out = pickNetworkSummariesForIssue(list, 10, 3000);
    expect(out[0].status).toBe(500);
    expect(out[1].url).toContain("/z");
    expect(out[2].url).toContain("/x");
  });

  it("dedupes same method+url+status", () => {
    const list = [
      e({ method: "POST", url: "https://a.test/api", status: 0, durationMs: 10, at: "2025-01-01T12:00:01.000Z" }),
      e({ method: "POST", url: "https://a.test/api", status: 0, durationMs: 20, at: "2025-01-01T12:00:02.000Z" }),
    ];
    const out = pickNetworkSummariesForIssue(list, 10, 3000);
    expect(out).toHaveLength(1);
    expect(out[0].durationMs).toBe(20);
  });
});

describe("summariesToFailedRequests", () => {
  it("maps errors only", () => {
    const list = [
      e({ method: "GET", url: "https://a.test/a", status: 404, durationMs: 10 }),
      e({ method: "GET", url: "https://a.test/b", status: 200, durationMs: 10 }),
    ];
    const fr = summariesToFailedRequests(list, 5);
    expect(fr).toHaveLength(1);
    expect(fr[0].status).toBe(404);
  });
});
