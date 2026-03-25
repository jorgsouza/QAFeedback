import { describe, expect, it } from "vitest";
import { EXTENSION_ROOT_HOST_ID } from "./extension-constants";
import { buildIssueBody, buildIssueTitle } from "./issue-builder";
import type { CreateIssuePayload } from "./types";

const pageCtx = {
  url: "https://exemplo.test/foo",
  pathname: "/foo",
  routeSearch: "",
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
        technicalContext: {
          page: { ...pageCtx },
          console: [],
          failedRequests: [],
        },
      }),
    );
    expect(md).toContain("## Contexto técnico");
    expect(md).toContain("https://exemplo.test/foo");
    expect(md).toContain("- Rota:");
    expect(md).toContain("/foo");
    expect(md).toContain("Ecrã (screen):");
    expect(md).toContain("Vista / dispositivo");
    expect(md).toContain("Indício de teste.");
  });

  it("does not add elemento afetado for the extension root host id", () => {
    const md = buildIssueBody(
      payload({
        includeTechnicalContext: true,
        technicalContext: {
          page: {
            url: "https://x.test/",
            pathname: "/",
            routeSearch: "",
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
        technicalContext: {
          page: {
            url: "https://x.test/",
            pathname: "/",
            routeSearch: "",
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
});
