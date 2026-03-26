import { describe, expect, it } from "vitest";
import {
  buildCorrelationHypothesisMarkdown,
  buildResumoLine,
  buildSessionHighlightsMarkdown,
  firstSentence,
} from "./issue-narrative";
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

  it("adds correlation hypothesis without claiming causation", () => {
    const md = buildCorrelationHypothesisMarkdown({
      version: 1,
      page: { ...pageCtx },
      console: [],
      failedRequests: [],
      interactionTimeline: [
        { at: "2025-01-01T12:00:00.000Z", kind: "click", summary: "Botão OK" },
      ],
      networkRequestSummaries: [
        {
          at: "2025-01-01T12:00:00.400Z",
          method: "POST",
          url: "https://api.test/submit",
          status: 500,
          durationMs: 40,
          isCorrelated: true,
          deltaToLastActionMs: 400,
          correlationTriggerKind: "click",
        },
      ],
      runtimeErrors: [
        { at: "2025-01-01T12:00:00.800Z", kind: "error", message: "boom", deltaToLastActionMs: 800 },
      ],
      visualState: { dialogs: [{ type: "dialog", title: "Confirmação" }] },
    });
    expect(md).toContain("Correlação temporal");
    expect(md).not.toMatch(/causado por/i);
    expect(md).toContain("pedido(s)");
    expect(md).toContain("Erro de runtime");
    expect(md).toContain("diálogo");
  });

  it("buildSessionHighlightsMarkdown appends hypothesis when correlates exist", () => {
    const md = buildSessionHighlightsMarkdown({
      version: 1,
      page: { ...pageCtx },
      console: [],
      failedRequests: [],
      interactionTimeline: [{ at: "2025-01-01T12:00:00.000Z", kind: "click", summary: "x" }],
      networkRequestSummaries: [
        {
          at: "2025-01-01T12:00:00.300Z",
          method: "GET",
          url: "https://a/z",
          status: 200,
          durationMs: 10,
          isCorrelated: true,
          deltaToLastActionMs: 300,
          correlationTriggerKind: "click",
        },
      ],
    });
    expect(md).toContain("Linha do tempo:");
    expect(md).toContain("Correlação temporal");
  });
});
