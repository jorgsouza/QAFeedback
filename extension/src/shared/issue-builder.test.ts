import { describe, expect, it } from "vitest";
import { EXTENSION_ROOT_HOST_ID } from "./extension-constants";
import { buildIssueBody, buildIssueTitle } from "./issue-builder";
import type { CreateIssuePayload } from "./types";

const pageCtx = {
  url: "https://exemplo.test/foo",
  pathname: "/foo",
  routeSearch: "",
  routeSlug: "ra-foo",
  routeLabel: "Outra",
  routeKey: "other",
  title: "Página",
  userAgent: "UA",
  timestamp: "2025-01-01T00:00:00.000Z",
  viewport: "800x600",
  screenCss: "1920x1080",
  devicePixelRatio: "1",
  maxTouchPoints: 0,
  pointerCoarse: false,
  viewModeHint: "Indício de teste.",
};

function payload(p: Partial<CreateIssuePayload> = {}): CreateIssuePayload {
  return {
    title: "Login falha",
    whatHappened: "O botão não responde após clicar.",
    includeTechnicalContext: false,
    sendToGitHub: true,
    sendToJira: false,
    jiraMotivoAbertura: "",
    ...p,
  };
}

describe("buildIssueTitle", () => {
  it("returns trimmed title from payload", () => {
    expect(buildIssueTitle(payload({ title: "  espaços  " }))).toBe("espaços");
  });
});

describe("buildIssueBody", () => {
  it("includes the what happened section when text is present", () => {
    const md = buildIssueBody(payload());
    expect(md).toContain("## Resumo");
    expect(md).toContain("Login falha");
    expect(md).toContain("## O que aconteceu");
    expect(md).toContain("O botão não responde após clicar.");
  });

  it("omits technical context when disabled", () => {
    const md = buildIssueBody(payload({ includeTechnicalContext: false }));
    expect(md).not.toContain("## Contexto técnico");
  });

  it("includes technical context block when enabled and context is provided", () => {
    const md = buildIssueBody(
      payload({
        includeTechnicalContext: true,
        capturedContext: {
          version: 1,
          page: { ...pageCtx },
          console: [],
          failedRequests: [],
        },
      }),
    );
    expect(md).toContain("## Contexto técnico");
    expect(md).toContain("https://exemplo.test/foo");
    expect(md).toContain("- Rota técnica:");
    expect(md).toContain("`ra-foo`");
    expect(md).toContain("/foo");
    expect(md).toContain("Ecrã (screen):");
    expect(md).toContain("Vista / dispositivo");
    expect(md).toContain("Indício de teste.");
    expect(md).toContain("Schema de contexto (extensão): **v1**");
    expect(md).toContain("Phase 3");
    expect(md).not.toContain("## Leitura rápida da sessão");
  });

  it("shows Requisições relevantes when networkRequestSummaries present", () => {
    const md = buildIssueBody(
      payload({
        includeTechnicalContext: true,
        capturedContext: {
          version: 1,
          page: { ...pageCtx },
          console: [],
          failedRequests: [],
          networkRequestSummaries: [
            {
              at: "2025-01-01T12:00:00.000Z",
              method: "POST",
              url: "https://exemplo.test/api/x",
              status: 500,
              durationMs: 1200,
              requestId: "req-abc",
            },
          ],
        },
      }),
    );
    expect(md).toContain("## Requisições relevantes");
    expect(md).toContain("POST https://exemplo.test/api/x");
    expect(md).toContain("500 em 1200ms");
    expect(md).toContain("x-request-id");
    expect(md).not.toContain("## Requests com falha");
    expect(md).toContain("## Leitura rápida da sessão");
    expect(md).toContain("Rede (resumo):");
  });

  it("falls back to Requests com falha when no network summaries", () => {
    const md = buildIssueBody(
      payload({
        includeTechnicalContext: true,
        capturedContext: {
          version: 1,
          page: { ...pageCtx },
          console: [],
          failedRequests: [
            { method: "GET", url: "https://exemplo.test/boom", status: 502, message: "bad" },
          ],
        },
      }),
    );
    expect(md).toContain("## Requests com falha");
    expect(md).toContain("502");
    expect(md).not.toContain("## Requisições relevantes");
  });

  it("includes interaction timeline when present", () => {
    const md = buildIssueBody(
      payload({
        includeTechnicalContext: true,
        capturedContext: {
          version: 1,
          page: { ...pageCtx },
          console: [],
          failedRequests: [],
          interactionTimeline: [
            {
              at: "2025-01-01T12:00:00.000Z",
              kind: "navigate",
              summary: "SPA pushState → /foo",
            },
            { at: "2025-01-01T12:00:01.000Z", kind: "click", summary: 'Clicou em button "OK"' },
          ],
        },
      }),
    );
    expect(md).toContain("## Linha do tempo da interação");
    expect(md).toContain("Navegação");
    expect(md).toContain("SPA pushState");
    expect(md).toContain("Clique");
    expect(md).toContain("## Leitura rápida da sessão");
    expect(md).toContain("Linha do tempo:");
  });

  it("does not add elemento afetado for the extension root host id", () => {
    const md = buildIssueBody(
      payload({
        includeTechnicalContext: true,
        capturedContext: {
          version: 1,
          page: {
            url: "https://x.test/",
            pathname: "/",
            routeSearch: "",
            routeSlug: "ra-root",
            routeLabel: "Início",
            routeKey: "root",
            title: "t",
            userAgent: "u",
            timestamp: "t",
            viewport: "1x1",
            screenCss: "1x1",
            devicePixelRatio: "1",
            maxTouchPoints: 0,
            pointerCoarse: false,
            viewModeHint: "x",
          },
          element: {
            tag: "div",
            id: EXTENSION_ROOT_HOST_ID,
            classes: "",
            safeAttributes: "",
          },
          console: [],
          failedRequests: [],
        },
      }),
    );
    expect(md).not.toContain("## Elemento afetado");
  });

  it("includes console lines when present", () => {
    const md = buildIssueBody(
      payload({
        includeTechnicalContext: true,
        capturedContext: {
          version: 1,
          page: {
            url: "https://x.test/",
            pathname: "/",
            routeSearch: "",
            routeSlug: "ra-root",
            routeLabel: "Início",
            routeKey: "root",
            title: "t",
            userAgent: "u",
            timestamp: "t",
            viewport: "1x1",
            screenCss: "1x1",
            devicePixelRatio: "1",
            maxTouchPoints: 0,
            pointerCoarse: false,
            viewModeHint: "x",
          },
          console: [{ level: "error", message: "boom" }],
          failedRequests: [],
        },
      }),
    );
    expect(md).toContain("## Console");
    expect(md).toContain("(error) boom");
  });

  it("includes visual state and target hint when present", () => {
    const md = buildIssueBody(
      payload({
        includeTechnicalContext: true,
        capturedContext: {
          version: 1,
          page: { ...pageCtx },
          console: [],
          failedRequests: [],
          visualState: {
            dialogs: [{ type: "dialog", title: "Modal X" }],
            busyIndicators: ["spinner"],
            activeTabs: ["Tab A"],
          },
          targetDomHint: {
            selectorHint: 'button[data-testid="qaf-send"]',
            role: "button",
            ariaLabel: "Enviar",
            textHint: "Enviar feedback",
            rect: { w: 120, h: 32 },
          },
        },
      }),
    );
    expect(md).toContain("## Estado visual no momento do bug");
    expect(md).toContain("Diálogo(s)/modal aberto(s)");
    expect(md).toContain("## Elemento relacionado");
    expect(md).toContain("Seletor sugerido");
    expect(md).toContain("aria-label");
  });
});
