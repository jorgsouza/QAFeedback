/**
 * Narrativa humana para o corpo da issue (GitHub/Jira).
 * Funções puras consumidas por `issue-builder.ts`.
 */
import type { CapturedIssueContextV1, CreateIssuePayload } from "./types";
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

/** Indicadores automáticos (contagens) antes do bloco técnico longo. */
export function buildSessionHighlightsMarkdown(ctx: CapturedIssueContextV1): string {
  const tl = ctx.interactionTimeline ?? [];
  const nets = ctx.networkRequestSummaries ?? [];
  const lines: string[] = [];

  if (tl.length) {
    const clicks = tl.filter((e) => e.kind === "click").length;
    const navs = tl.filter((e) => e.kind === "navigate").length;
    lines.push(
      `- **Linha do tempo:** ${tl.length} evento(s) — ${clicks} clique(s), ${navs} navegação(ões) (SPA/popstate).`,
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

  return lines.join("\n");
}
