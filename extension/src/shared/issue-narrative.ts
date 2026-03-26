/**
 * Narrativa humana para o corpo da issue (GitHub/Jira).
 * Funções puras consumidas por `issue-builder.ts`.
 */
import { CAPTURE_LIMITS } from "./context-limits";
import { lastMeaningfulTimelineAnchor } from "./session-correlation";
import type {
  CapturedIssueContextV1,
  CreateIssuePayload,
  InteractionTimelineKindV1,
} from "./types";
import { truncate } from "./sanitizer";

const RESUMO_SENTENCE_MAX = 220;

export function firstSentence(text: string, maxLen = RESUMO_SENTENCE_MAX): string {
  const t = text.trim();
  if (!t) return "";
  const m = t.match(/^[^.!?\n]+[.!?]?/);
  const chunk = (m ? m[0] : t.split("\n")[0] ?? t).trim();
  return truncate(chunk, maxLen);
}

/** Uma linha: título + primeira frase do relato (quando existir). */
export function buildResumoLine(payload: CreateIssuePayload): string {
  const title = payload.title.trim();
  if (!title) return "";
  const fs = firstSentence(payload.whatHappened);
  return fs ? `${title} — ${fs}` : title;
}

function timelineKindLabelPt(kind: InteractionTimelineKindV1): string {
  const labels: Record<InteractionTimelineKindV1, string> = {
    click: "clique",
    submit: "envio de formulário",
    input: "input",
    change: "alteração de campo",
    keydown: "tecla",
    navigate: "navegação (SPA)",
    scroll: "scroll",
    dialog: "modal / diálogo",
    section: "aba/secção",
  };
  return labels[kind];
}

function formatClockIso(iso: string): string {
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

/**
 * Bloco opcional: hipótese de investigação por proximidade no tempo (sem linguagem causal forte).
 */
export function buildCorrelationHypothesisMarkdown(ctx: CapturedIssueContextV1): string {
  const anchor = lastMeaningfulTimelineAnchor(ctx.interactionTimeline ?? []);
  if (!anchor) return "";

  const nets = ctx.networkRequestSummaries ?? [];
  const correlated = nets.filter((n) => n.isCorrelated);
  const re = ctx.runtimeErrors ?? [];
  const principal = re.length ? re[re.length - 1] : undefined;
  const vis = ctx.visualState;
  const hasVis = Boolean(vis?.dialogs?.length || vis?.busyIndicators?.length);
  const hasErrCorrel = principal?.deltaToLastActionMs != null;

  if (!correlated.length && !hasErrCorrel && !hasVis) return "";

  const parts: string[] = [];
  parts.push(
    "> **Correlação temporal** — útil para investigar; **não** indica causa comprovada (evitar atribuir efeito causal só com base nesta ordem).",
  );
  parts.push(
    `- Última âncora na linha do tempo: **${timelineKindLabelPt(anchor.kind)}** — ${truncate(anchor.summary, 96)} (\`${formatClockIso(anchor.at)}\`).`,
  );
  if (correlated.length) {
    const winS = Math.round(CAPTURE_LIMITS.correlationWindowAfterActionMs / 1000);
    parts.push(
      `- **${correlated.length}** pedido(s) listado(s) na rede ocorreram até **${winS}s** depois dessa âncora (coincidência possível).`,
    );
  }
  if (hasErrCorrel && principal?.deltaToLastActionMs != null) {
    parts.push(
      `- Erro de runtime destacado surgiu **~${Math.round(principal.deltaToLastActionMs)}ms** depois da âncora (ordem no tempo, não relação causal).`,
    );
  }
  if (hasVis) {
    const bits: string[] = [];
    if (vis?.dialogs?.length) bits.push("diálogo/modal visível");
    if (vis?.busyIndicators?.length) bits.push("busy/loading");
    parts.push(`- No envio do feedback: ${bits.join(" · ")}.`);
  }
  return parts.join("\n");
}

/** Indicadores automáticos (contagens) antes do bloco técnico longo. */
export function buildSessionHighlightsMarkdown(ctx: CapturedIssueContextV1): string {
  const tl = ctx.interactionTimeline ?? [];
  const nets = ctx.networkRequestSummaries ?? [];
  const lines: string[] = [];

  if (tl.length) {
    const clicks = tl.filter((e) => e.kind === "click").length;
    const navs = tl.filter((e) => e.kind === "navigate").length;
    const scrolls = tl.filter((e) => e.kind === "scroll").length;
    const dialogs = tl.filter((e) => e.kind === "dialog").length;
    const sections = tl.filter((e) => e.kind === "section").length;
    const extras = [
      scrolls ? `${scrolls} scroll` : "",
      dialogs ? `${dialogs} evento(s) de modal` : "",
      sections ? `${sections} troca(s) de aba/secção` : "",
    ].filter(Boolean);
    const extraChunk = extras.length ? `; ${extras.join(", ")}` : "";
    lines.push(
      `- **Linha do tempo:** ${tl.length} evento(s) — ${clicks} clique(s), ${navs} navegação(ões) (SPA/popstate)${extraChunk}.`,
    );
  }

  if (nets.length) {
    const errNet = nets.filter((e) => e.status >= 400 || e.status === 0).length;
    lines.push(
      `- **Rede (resumo):** ${nets.length} pedido(s) listado(s), ${errNet} com erro ou resposta opaca (status 0).`,
    );
  }

  const cons = ctx.console ?? [];
  if (cons.length) {
    const errs = cons.filter((c) => c.level === "error").length;
    lines.push(
      `- **Consola:** ${cons.length} linha(s) capturada(s)${errs ? `, ${errs} nível error.` : "."}`,
    );
  }

  const hyp = buildCorrelationHypothesisMarkdown(ctx);
  if (hyp.trim()) {
    if (lines.length) lines.push("");
    lines.push(hyp);
  }

  return lines.join("\n");
}
