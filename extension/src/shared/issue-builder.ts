import type {
  CreateIssuePayload,
  ElementContext,
  InteractionTimelineKindV1,
  NetworkRequestSummaryEntryV1,
} from "./types";
import { CAPTURE_LIMITS } from "./context-limits";
import { EXTENSION_ROOT_HOST_ID } from "./extension-constants";
import { buildResumoLine, buildSessionHighlightsMarkdown } from "./issue-narrative";
import { truncate } from "./sanitizer";

function shouldIncludeElementSection(e: ElementContext): boolean {
  if (e.id === EXTENSION_ROOT_HOST_ID) return false;
  const t = e.tag.toLowerCase();
  if ((t === "html" || t === "body") && !e.id && !e.classes?.trim()) return false;
  return true;
}

function omitEmptySection(title: string, body: string | undefined): string {
  const b = body?.trim();
  if (!b) return "";
  return `## ${title}\n${b}\n\n`;
}

function formatConsole(entries: { level: string; message: string }[]): string {
  if (!entries.length) return "";
  return entries
    .map((e) => `- (${e.level}) ${truncate(e.message, 400)}`)
    .join("\n");
}

function formatFailed(reqs: { method: string; url: string; status: number; message: string }[]): string {
  if (!reqs.length) return "";
  return reqs
    .map(
      (r) =>
        `- ${r.method} ${r.url} → ${r.status}${r.message ? ` (${truncate(r.message, 200)})` : ""}`,
    )
    .join("\n");
}

function timelineKindLabelPt(kind: InteractionTimelineKindV1): string {
  const labels: Record<InteractionTimelineKindV1, string> = {
    click: "Clique",
    submit: "Envio de formulário",
    input: "Input",
    change: "Alteração de campo",
    keydown: "Tecla",
    navigate: "Navegação",
  };
  return labels[kind];
}

function formatTimelineClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(11, 19);
  }
}

function formatInteractionTimeline(
  entries: { at: string; kind: InteractionTimelineKindV1; summary: string }[],
): string {
  if (!entries.length) return "";
  return entries
    .map(
      (e, i) =>
        `${i + 1}. \`${formatTimelineClock(e.at)}\` · **${timelineKindLabelPt(e.kind)}** — ${truncate(e.summary, 220)}`,
    )
    .join("\n");
}

function formatNetworkRelevant(entries: NetworkRequestSummaryEntryV1[]): string {
  if (!entries.length) return "";
  const slowMs = CAPTURE_LIMITS.networkSlowThresholdMs;
  return entries
    .map((e) => {
      const bits: string[] = [`${e.method} ${e.url} → ${e.status} em ${e.durationMs}ms`];
      if (e.aborted) bits.push("abortida");
      const isErr = e.status >= 400 || e.status === 0;
      const isSlow = e.durationMs >= slowMs;
      if (isErr) bits.push("**erro**");
      else if (isSlow) bits.push("**lenta**");
      if (e.requestId) bits.push(`x-request-id: \`${truncate(e.requestId, 48)}\``);
      if (e.correlationId) bits.push(`x-correlation-id: \`${truncate(e.correlationId, 48)}\``);
      if (e.responseContentType) bits.push(`content-type: ${e.responseContentType}`);
      return `- ${bits.join(" · ")}`;
    })
    .join("\n");
}

export function buildIssueBody(payload: CreateIssuePayload): string {
  const { title: _t, includeTechnicalContext: _i, capturedContext: ctx, ...form } = payload;
  let md = "";
  const resumo = buildResumoLine(payload);
  if (resumo.trim()) {
    md += `## Resumo\n${resumo}\n\n`;
  }
  md += omitEmptySection("O que aconteceu", form.whatHappened);

  if (payload.includeTechnicalContext && ctx) {
    const highlights = buildSessionHighlightsMarkdown(ctx);
    if (highlights.trim()) {
      md += "## Leitura rápida da sessão\n";
      md += `${highlights}\n\n`;
    }

    const p = ctx.page;
    md += "## Contexto técnico\n";
    md += `- URL: ${p.url}\n`;
    const searchBit = p.routeSearch.trim() ? ` · query: ${truncate(p.routeSearch, 200)}` : "";
    md += `- Rota técnica: \`${p.routeSlug}\` · ${p.routeLabel} · path: \`${p.pathname}\`${searchBit}\n`;
    md += `- Página: ${p.title}\n`;
    md += `- Data/Hora: ${p.timestamp}\n`;
    md += `- Navegador: ${truncate(p.userAgent, 300)}\n`;
    md += `- Viewport (janela): ${p.viewport}\n`;
    md += `- Ecrã (screen): ${p.screenCss} · DPR: ${p.devicePixelRatio} · maxTouchPoints: ${p.maxTouchPoints} · pointer: ${p.pointerCoarse ? "coarse" : "fine"}\n`;
    md += `- Vista / dispositivo (indício automático): ${p.viewModeHint}\n`;
    md += `- Schema de contexto (extensão): **v${ctx.version}** — Phase 3 (narrativa + timeline + rede resumida)\n\n`;

    const tl = formatInteractionTimeline(ctx.interactionTimeline ?? []);
    if (tl) {
      md += "## Linha do tempo da interação\n";
      md += `${tl}\n\n`;
    }

    if (ctx.element && shouldIncludeElementSection(ctx.element)) {
      const e = ctx.element;
      md += "## Elemento afetado\n";
      md += `- Tag: ${e.tag}\n`;
      md += `- ID: ${e.id || "(sem id)"}\n`;
      md += `- Classes: ${e.classes || "(sem classes)"}\n`;
      if (e.safeAttributes) md += `- Atributos: ${e.safeAttributes}\n`;
      md += "\n";
    }

    const c = formatConsole(ctx.console);
    if (c) {
      md += "## Console\n";
      md += `${c}\n\n`;
    }

    const net = ctx.networkRequestSummaries?.length
      ? formatNetworkRelevant(ctx.networkRequestSummaries)
      : "";
    if (net) {
      md += "## Requisições relevantes\n";
      md += `${net}\n\n`;
    } else {
      const f = formatFailed(ctx.failedRequests);
      if (f) {
        md += "## Requests com falha\n";
        md += `${f}\n\n`;
      }
    }
  }

  return md.trimEnd();
}

export function buildIssueTitle(payload: CreateIssuePayload): string {
  return payload.title.trim();
}
