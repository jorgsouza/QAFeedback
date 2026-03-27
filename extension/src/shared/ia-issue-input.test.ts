import { describe, expect, it } from "vitest";
import { buildIaIssueInputV1 } from "./ia-issue-input";
import type { CapturedIssueContextV1, CreateIssuePayload } from "./types";

const minimalPage = {
  url: "https://exemplo.test/p",
  pathname: "/p",
  routeSearch: "",
  routeSlug: "ra-p",
  routeLabel: "P",
  routeKey: "other",
  title: "T",
  userAgent: "UA",
  timestamp: "2026-03-27T12:00:00.000Z",
  viewport: "800x600",
  screenCss: "800x600",
  devicePixelRatio: "1",
  maxTouchPoints: 0,
  pointerCoarse: false,
  viewModeHint: "hint",
};

describe("buildIaIssueInputV1", () => {
  it("produces identical JSON for the same payload (serialização estável)", () => {
    const capturedContext: CapturedIssueContextV1 = {
      version: 1,
      page: { ...minimalPage, routeKey: "home" },
      console: [],
      failedRequests: [],
      captureMode: "debug-interno",
      interactionTimeline: [
        { at: "2026-03-27T10:00:00.000Z", kind: "click", summary: "Botão Salvar" },
        { at: "2026-03-27T10:00:01.000Z", kind: "scroll", summary: "scroll" },
      ],
      networkRequestSummaries: [
        {
          at: "2026-03-27T10:00:02.000Z",
          method: "GET",
          url: "https://exemplo.test/api/x",
          status: 500,
          durationMs: 120,
          isCorrelated: true,
        },
      ],
      runtimeErrors: [
        { at: "2026-03-27T10:00:03.000Z", kind: "error", message: "fail" },
      ],
      visualState: { dialogs: [{ type: "dialog" }], busyIndicators: ["spinner"] },
      appEnvironment: { appName: "App", environmentName: "staging" },
      sensitiveFindings: [
        {
          kind: "pii",
          severity: "low",
          source: "console",
          location: "c1",
          summary: "s",
          evidenceFingerprint: "f1",
          samplePreview: "p",
        },
        {
          kind: "secret_or_token",
          severity: "high",
          source: "network",
          location: "n1",
          summary: "s2",
          evidenceFingerprint: "f2",
          samplePreview: "p2",
        },
      ],
    };

    const payload: CreateIssuePayload = {
      title: "Bug login",
      whatHappened: "Não carrega.",
      includeTechnicalContext: true,
      sendToGitHub: false,
      sendToJira: false,
      jiraMotivoAbertura: "",
      capturedContext,
    };

    const a = buildIaIssueInputV1(payload);
    const b = buildIaIssueInputV1(payload);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));

    expect(a.primaryAction).toEqual({
      kind: "click",
      summary: "Botão Salvar",
      at: "2026-03-27T10:00:00.000Z",
    });
    expect(a.primaryRequest).toEqual({
      method: "GET",
      url: "https://exemplo.test/api/x",
      status: 500,
      durationMs: 120,
      isCorrelated: true,
    });
    expect(a.primaryRuntimeError).toEqual({
      kind: "error",
      message: "fail",
      at: "2026-03-27T10:00:03.000Z",
    });
    expect(a.sensitiveFindings).toEqual({
      count: 2,
      kinds: ["pii", "secret_or_token"],
    });
    expect(a.visualState).toEqual({
      dialogCount: 1,
      busyIndicatorCount: 1,
      activeTabCount: 0,
    });
    expect(a.appEnvironment).toEqual({ appName: "App", environmentName: "staging" });
    expect(a.networkRequestCount).toBe(1);
    expect(a.timelineEntryCount).toBe(2);
  });

  it("sem capturedContext, campos técnicos ficam nulos", () => {
    const payload: CreateIssuePayload = {
      title: "Só texto",
      whatHappened: "Ok",
      includeTechnicalContext: false,
      sendToGitHub: false,
      sendToJira: false,
      jiraMotivoAbertura: "",
    };
    const out = buildIaIssueInputV1(payload);
    expect(out.pageRoute).toBeNull();
    expect(out.primaryAction).toBeNull();
    expect(out.primaryRequest).toBeNull();
    expect(out.primaryRuntimeError).toBeNull();
    expect(out.visualState).toBeNull();
    expect(out.appEnvironment).toBeNull();
    expect(out.sensitiveFindings).toBeNull();
    expect(out.captureMode).toBeNull();
    expect(out.userNarrative).toEqual({ title: "Só texto", whatHappened: "Ok" });
  });

  it("timeline só com scroll não produz primaryAction", () => {
    const capturedContext: CapturedIssueContextV1 = {
      version: 1,
      page: minimalPage,
      console: [],
      failedRequests: [],
      interactionTimeline: [{ at: "2026-03-27T10:00:00.000Z", kind: "scroll", summary: "y" }],
    };
    const out = buildIaIssueInputV1({
      title: "t",
      whatHappened: "w",
      includeTechnicalContext: true,
      sendToGitHub: false,
      sendToJira: false,
      jiraMotivoAbertura: "",
      capturedContext,
    });
    expect(out.primaryAction).toBeNull();
  });
});
