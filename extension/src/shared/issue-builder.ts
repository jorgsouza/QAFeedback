import type {
  CreateIssuePayload,
  ElementContext,
  InteractionTimelineKindV1,
  NetworkRequestSummaryEntryV1,
  PerformanceSignalsSnapshotV1,
  RuntimeErrorSnapshotV1,
  TargetDomHintV1,
  VisualStateSnapshotV1,
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

function formatVisualState(state: VisualStateSnapshotV1): string {
  const lines: string[] = [];
  if (state.dialogs?.length) {
    const ds = state.dialogs
      .map((d) => (d.title ? `${d.type} (\"${truncate(d.title, 90)}\")` : d.type))
      .slice(0, 3)
      .join(", ");
    lines.push(`- Diálogo(s)/modal aberto(s): ${ds}`);
  }
  if (state.busyIndicators?.length) {
    const bs = state.busyIndicators
      .slice(0, 3)
      .map((b) => `"${truncate(b, 90)}"`)
      .join(", ");
    lines.push(`- Indicadores de loading/busy: ${bs}`);
  }
  if (state.activeTabs?.length) {
    const ts = state.activeTabs.slice(0, 3).map((t) => `"${truncate(t, 90)}"`).join(", ");
    lines.push(`- Aba(s) ativa(s): ${ts}`);
  }
  return lines.join("\n");
}

function formatTargetDomHint(h: TargetDomHintV1): string {
  const lines: string[] = [];
  if (h.selectorHint) lines.push(`- Seletor sugerido: \`${truncate(h.selectorHint, 180)}\``);
  if (h.role) lines.push(`- role: \`${truncate(h.role, 80)}\``);
  if (h.ariaLabel) lines.push(`- aria-label: "${truncate(h.ariaLabel, 200)}"`);
  if (h.textHint) lines.push(`- Texto (hint): "${truncate(h.textHint, 200)}"`);
  if (h.rect && Number.isFinite(h.rect.w) && Number.isFinite(h.rect.h)) {
    lines.push(`- Dimensão aproximada: ${h.rect.w}x${h.rect.h}px`);
  }
  return lines.join("\n");
}

function formatRuntimePrincipalError(err: RuntimeErrorSnapshotV1): string {
  const lines: string[] = [];
  lines.push(`- Tipo: ${err.kind}`);
  lines.push(`- Mensagem: ${truncate(err.message, 360)}`);
  if (err.count && err.count > 1) lines.push(`- Ocorrências (agregadas): ${err.count}`);
  if (err.file) {
    const pos = err.line ? `:${err.line}${err.col ? `:${err.col}` : ""}` : "";
    lines.push(`- Local: ${truncate(err.file, 120)}${pos}`);
  }
  if (err.deltaToLastClickMs != null) lines.push(`- Δ desde último clique: ${Math.round(err.deltaToLastClickMs)}ms`);
  if (err.stack) lines.push(`- Stack (truncado): \`${truncate(err.stack, 320)}\``);
  return lines.join("\n");
}

function formatPerformanceSignals(p: PerformanceSignalsSnapshotV1): string {
  const lines: string[] = [];
  if (p.lcpMs != null) {
    lines.push(`- LCP: ${Math.round(p.lcpMs)}ms${p.lcpAt ? ` (at: ${p.lcpAt})` : ""}`);
  }
  if (p.inpMs != null) {
    lines.push(`- INP (best-effort): ${Math.round(p.inpMs)}ms${p.inpAt ? ` (at: ${p.inpAt})` : ""}`);
  }
  if (p.cls != null) {
    const cls = Number(p.cls);
    lines.push(`- CLS (cumulado, best-effort): ${Number.isFinite(cls) ? cls.toFixed(3) : String(p.cls)}`);
  }
  if (p.longTasks?.count) {
    lines.push(
      `- Long tasks (best-effort): ${p.longTasks.count}${p.longTasks.longestMs != null ? `, pior: ${Math.round(p.longTasks.longestMs)}ms` : ""}`,
    );
  }
  return lines.join("\n");
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

    if (
      ctx.visualState &&
      (ctx.visualState.dialogs?.length ||
        ctx.visualState.busyIndicators?.length ||
        ctx.visualState.activeTabs?.length)
    ) {
      md += "## Estado visual no momento do bug\n";
      md += `${formatVisualState(ctx.visualState)}\n\n`;
    }

    if (ctx.targetDomHint && (ctx.targetDomHint.selectorHint || ctx.targetDomHint.role || ctx.targetDomHint.textHint)) {
      md += "## Elemento relacionado\n";
      md += `${formatTargetDomHint(ctx.targetDomHint)}\n\n`;
    }

    if (ctx.runtimeErrors?.length) {
      const principal = ctx.runtimeErrors[ctx.runtimeErrors.length - 1]!;
      md += "## Erro de runtime principal\n";
      md += `${formatRuntimePrincipalError(principal)}\n\n`;
    }

    if (ctx.performanceSignals) {
      const p = ctx.performanceSignals;
      const hasAny =
        p.lcpMs != null || p.inpMs != null || p.cls != null || (p.longTasks?.count ?? 0) > 0;
      if (hasAny) {
        md += "## Sinais de performance\n";
        md += `${formatPerformanceSignals(p)}\n\n`;
      }
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
