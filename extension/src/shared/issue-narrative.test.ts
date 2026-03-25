import { describe, expect, it } from "vitest";
import { buildResumoLine, buildSessionHighlightsMarkdown, firstSentence } from "./issue-narrative";
import type { CreateIssuePayload } from "./types";

const pageCtx = {
  url: "https://exemplo.test/",
  pathname: "/",
  routeSearch: "",
  routeSlug: "x",
  routeLabel: "X",
  routeKey: "other",
  title: "P",
  userAgent: "UA",
  timestamp: "t",
  viewport: "1x1",
  screenCss: "1x1",
  devicePixelRatio: "1",
  maxTouchPoints: 0,
  pointerCoarse: false,
  viewModeHint: "h",
};

function payload(p: Partial<CreateIssuePayload> = {}): CreateIssuePayload {
  return {
    title: "Bug no checkout",
    whatHappened: "O total fica errado. Depois de aplicar cupão.",
    includeTechnicalContext: true,
    sendToGitHub: true,
    sendToJira: false,
    jiraMotivoAbertura: "",
    ...p,
  };
}

describe("issue-narrative", () => {
  it("firstSentence stops at sentence end", () => {
    expect(firstSentence("Olá mundo. Mais texto.")).toBe("Olá mundo.");
  });

  it("buildResumoLine joins title and first sentence", () => {
    expect(buildResumoLine(payload())).toContain("Bug no checkout");
    expect(buildResumoLine(payload())).toContain("O total fica errado.");
  });

  it("buildSessionHighlightsMarkdown summarizes timeline and network", () => {
    const md = buildSessionHighlightsMarkdown({
      version: 1,
      page: { ...pageCtx },
      console: [{ level: "warn", message: "x" }],
      failedRequests: [],
      interactionTimeline: [
        { at: "2025-01-01T12:00:00.000Z", kind: "click", summary: "c1" },
        { at: "2025-01-01T12:00:01.000Z", kind: "navigate", summary: "n1" },
      ],
      networkRequestSummaries: [
        { at: "t", method: "GET", url: "https://a.test/x", status: 200, durationMs: 10 },
        { at: "t", method: "GET", url: "https://a.test/y", status: 0, durationMs: 20 },
      ],
    });
    expect(md).toContain("Linha do tempo:");
    expect(md).toContain("1 clique");
    expect(md).toContain("1 navegação");
    expect(md).toContain("Rede (resumo):");
    expect(md).toContain("Consola:");
  });
});
