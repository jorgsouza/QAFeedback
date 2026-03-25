import type { FailedRequestEntry, NetworkRequestSummaryEntryV1 } from "./types";

/**
 * Ordena e limita entradas para a issue: erros primeiro, depois lentas, depois restantes;
 * dedupe por método + URL + status (mantém a de maior prioridade).
 */
export function pickNetworkSummariesForIssue(
  entries: NetworkRequestSummaryEntryV1[],
  max: number,
  slowThresholdMs: number,
): NetworkRequestSummaryEntryV1[] {
  if (!entries.length || max <= 0) return [];

  const scored = entries.map((e) => {
    const isError = e.status >= 400 || e.status === 0;
    const isSlow = e.durationMs >= slowThresholdMs;
    const priority = isError ? 0 : isSlow ? 1 : 2;
    return { e, priority, t: new Date(e.at).getTime() };
  });

  scored.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.t - a.t;
  });

  const seen = new Set<string>();
  const out: NetworkRequestSummaryEntryV1[] = [];
  for (const { e } of scored) {
    const key = `${e.method}|${e.url}|${e.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= max) break;
  }
  return out;
}

/** Compatível com secção legada “Requests com falha” quando não há resumo rico. */
export function summariesToFailedRequests(
  entries: NetworkRequestSummaryEntryV1[],
  max: number,
): FailedRequestEntry[] {
  const errs = entries.filter((e) => e.status >= 400 || e.status === 0);
  return errs.slice(0, max).map((e) => ({
    method: e.method,
    url: e.url,
    status: e.status,
    message: truncateFailedMessage(e),
  }));
}

function truncateFailedMessage(e: NetworkRequestSummaryEntryV1): string {
  const parts: string[] = [];
  if (e.aborted) parts.push("aborted");
  if (e.statusText) parts.push(e.statusText);
  if (e.durationMs != null) parts.push(`${e.durationMs}ms`);
  const s = parts.join(" · ");
  return s.length > 200 ? `${s.slice(0, 199)}…` : s;
}
