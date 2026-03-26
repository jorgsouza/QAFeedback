/**
 * PRD-011 Fase 4 — correlação temporal entre timeline, rede e erros (sem afirmar causalidade).
 */
import type {
  InteractionTimelineEntryV1,
  InteractionTimelineKindV1,
  NetworkRequestSummaryEntryV1,
  RuntimeErrorSnapshotV1,
} from "./types";

const ANCHOR_KINDS = new Set<InteractionTimelineKindV1>(["click", "submit", "navigate"]);

export type TimelineAnchorV1 = {
  at: string;
  atMs: number;
  kind: InteractionTimelineKindV1;
  summary: string;
};

/** Última entrada “forte” na ordem cronológica (mais recente): clique, submit ou navegação. */
export function lastMeaningfulTimelineAnchor(
  timeline: InteractionTimelineEntryV1[],
): TimelineAnchorV1 | undefined {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const e = timeline[i]!;
    if (!ANCHOR_KINDS.has(e.kind)) continue;
    const atMs = new Date(e.at).getTime();
    if (!Number.isFinite(atMs)) continue;
    return { at: e.at, atMs, kind: e.kind, summary: e.summary };
  }
  return undefined;
}

export function attachNetworkRequestCorrelation(
  entries: NetworkRequestSummaryEntryV1[],
  anchor: TimelineAnchorV1 | undefined,
  windowMs: number,
): NetworkRequestSummaryEntryV1[] {
  if (!anchor) return entries.map((e) => ({ ...e }));
  return entries.map((e) => {
    const t = new Date(e.at).getTime();
    if (!Number.isFinite(t)) return { ...e };
    const delta = t - anchor.atMs;
    if (delta >= 0 && delta <= windowMs) {
      return {
        ...e,
        deltaToLastActionMs: delta,
        correlationTriggerKind: anchor.kind,
        isCorrelated: true,
      };
    }
    return { ...e };
  });
}

function runtimeErrorScore(e: RuntimeErrorSnapshotV1, windowMs: number): number {
  let s = 0;
  const d = e.deltaToLastActionMs;
  if (d != null && d >= 0 && d <= windowMs) {
    s += 1000;
    s += Math.max(0, 400 - Math.floor(d / 40));
  }
  s += Math.min(180, (e.count ?? 1) * 45);
  if (e.stack && e.stack.length > 24) s += 35;
  if (e.kind === "error") s += 12;
  return s;
}

/**
 * Enriquece erros com `deltaToLastActionMs` (e alinha `deltaToLastClickMs` quando a âncora é clique)
 * e coloca o erro considerado mais “principal” **por último** (compatível com `issue-builder`).
 */
export function enrichAndOrderRuntimeErrors(
  errors: RuntimeErrorSnapshotV1[],
  anchor: TimelineAnchorV1 | undefined,
  windowMs: number,
): RuntimeErrorSnapshotV1[] {
  if (!errors.length) return [];
  const anchorAtMs = anchor?.atMs;

  const decorated = errors.map((e) => {
    const errMs = new Date(e.at).getTime();
    if (!Number.isFinite(errMs) || anchorAtMs == null || errMs < anchorAtMs) {
      return { ...e };
    }
    const delta = errMs - anchorAtMs;
    const next: RuntimeErrorSnapshotV1 = { ...e, deltaToLastActionMs: delta };
    if (anchor?.kind === "click") next.deltaToLastClickMs = delta;
    return next;
  });

  if (decorated.length === 1) return decorated;

  let bestI = 0;
  let bestS = runtimeErrorScore(decorated[0]!, windowMs);
  for (let i = 1; i < decorated.length; i++) {
    const si = runtimeErrorScore(decorated[i]!, windowMs);
    if (si > bestS) {
      bestS = si;
      bestI = i;
    } else if (si === bestS) {
      const ta = new Date(decorated[i]!.at).getTime();
      const tb = new Date(decorated[bestI]!.at).getTime();
      if (ta > tb) bestI = i;
    }
  }

  const principal = decorated[bestI]!;
  const others = decorated
    .filter((_, i) => i !== bestI)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return [...others, principal];
}
