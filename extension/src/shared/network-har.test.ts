import { describe, expect, it } from "vitest";
import {
  buildHarRoot,
  harToJsonString,
  headerShouldRedact,
  redactHarRoot,
  type HarCaptureRecord,
} from "./network-har";

describe("headerShouldRedact", () => {
  it("identifica cabeçalhos sensíveis", () => {
    expect(headerShouldRedact("Cookie")).toBe(true);
    expect(headerShouldRedact("authorization")).toBe(true);
    expect(headerShouldRedact("Set-Cookie")).toBe(true);
    expect(headerShouldRedact("Accept")).toBe(false);
  });
});

describe("redactHarRoot", () => {
  it("substitui valores de cabeçalhos sensíveis", () => {
    const entries: HarCaptureRecord[] = [
      {
        startedDateTime: "2025-01-01T12:00:00.000Z",
        timeMs: 10,
        method: "GET",
        url: "https://example.com/x",
        requestHeaders: [
          { name: "Accept", value: "application/json" },
          { name: "Cookie", value: "secret=1" },
          { name: "Authorization", value: "Bearer token" },
        ],
        responseStatus: 200,
        responseStatusText: "OK",
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Set-Cookie", value: "sid=abc" },
        ],
        responseMimeType: "application/json",
        responseBodyText: "{}",
      },
    ];
    const har = buildHarRoot({
      entries,
      pageStartedDateTime: "2025-01-01T12:00:00.000Z",
    });
    redactHarRoot(har);
    const json = JSON.parse(harToJsonString(har)) as {
      log: {
        entries: {
          request: { headers: { name: string; value: string }[] };
          response: { headers: { name: string; value: string }[] };
        }[];
      };
    };
    const e = json.log.entries[0]!;
    expect(e.request.headers.find((h) => h.name === "Accept")?.value).toBe("application/json");
    expect(e.request.headers.find((h) => h.name === "Cookie")?.value).toBe("[REDACTED]");
    expect(e.request.headers.find((h) => h.name === "Authorization")?.value).toBe("[REDACTED]");
    expect(e.response.headers.find((h) => h.name === "Set-Cookie")?.value).toBe("[REDACTED]");
  });
});

describe("buildHarRoot", () => {
  it("produz HAR 1.2 com creator e página", () => {
    const har = buildHarRoot({
      entries: [],
      pageStartedDateTime: "2025-03-01T10:00:00.000Z",
      pageTitle: "Test",
    });
    expect(har.log.version).toBe("1.2");
    expect(har.log.creator.name).toBe("QA Feedback");
    expect(har.log.pages[0]!.id).toBe("page_1");
    expect(har.log.entries).toHaveLength(0);
  });
});
