import type { InteractionTimelineEntryV1 } from "./types";

/** Sessão de timeline por aba (persistida no SW + chrome.storage.session). */
export type TimelineTabSessionV1 = {
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  entries: InteractionTimelineEntryV1[];
};

export function timelineEntryFingerprint(e: InteractionTimelineEntryV1): string {
  const t = Date.parse(e.at);
  const bucket = Number.isFinite(t) ? Math.floor(t / 1000) : 0;
  return `${e.kind}|${e.summary}|${bucket}`;
}

/**
 * Junta listas de timeline, deduplica por fingerprint, ordena por `at`, aplica cap final.
 */
export function mergeTimelineEntryLists(
  a: InteractionTimelineEntryV1[],
  b: InteractionTimelineEntryV1[],
  maxEntries: number,
): InteractionTimelineEntryV1[] {
  const byFp = new Map<string, InteractionTimelineEntryV1>();
  for (const e of a) {
    byFp.set(timelineEntryFingerprint(e), e);
  }
  for (const e of b) {
    const fp = timelineEntryFingerprint(e);
    if (!byFp.has(fp)) byFp.set(fp, e);
  }
  const merged = Array.from(byFp.values()).sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
  return merged.slice(-maxEntries);
}

export function emptyTimelineSession(nowIso: string): TimelineTabSessionV1 {
  return {
    sessionId: "",
    startedAt: nowIso,
    updatedAt: nowIso,
    entries: [],
  };
}

/** Se passou o TTL desde updatedAt, limpa entradas (mantém sessionId para continuidade opcional). */
export function expireTimelineSessionIfStale(
  session: TimelineTabSessionV1,
  nowMs: number,
  ttlMs: number,
): TimelineTabSessionV1 {
  const u = Date.parse(session.updatedAt);
  if (!Number.isFinite(u) || nowMs - u <= ttlMs) return session;
  return {
    ...session,
    entries: [],
    updatedAt: new Date(nowMs).toISOString(),
  };
}

export function appendEntriesToSession(
  session: TimelineTabSessionV1,
  incoming: InteractionTimelineEntryV1[],
  nowIso: string,
  maxEntries: number,
): TimelineTabSessionV1 {
  const merged = mergeTimelineEntryLists(session.entries, incoming, maxEntries);
  return {
    ...session,
    updatedAt: nowIso,
    entries: merged,
  };
}

/**
 * Timeline final para a issue: união SW + bridge atual, dedupe, últimos N para exibição.
 */
export function mergeSessionAndBridgeTimelines(
  sessionEntries: InteractionTimelineEntryV1[] | undefined,
  bridgeEntries: InteractionTimelineEntryV1[],
  maxForIssue: number,
): InteractionTimelineEntryV1[] {
  return mergeTimelineEntryLists(sessionEntries ?? [], bridgeEntries, maxForIssue);
}

export function parseTimelineTabSession(raw: unknown): TimelineTabSessionV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.updatedAt !== "string" || !Array.isArray(o.entries)) return null;
  const entries = o.entries.filter(
    (x): x is InteractionTimelineEntryV1 =>
      !!x &&
      typeof x === "object" &&
      typeof (x as InteractionTimelineEntryV1).at === "string" &&
      typeof (x as InteractionTimelineEntryV1).kind === "string" &&
      typeof (x as InteractionTimelineEntryV1).summary === "string",
  );
  return {
    sessionId: typeof o.sessionId === "string" ? o.sessionId : "",
    startedAt: typeof o.startedAt === "string" ? o.startedAt : o.updatedAt,
    updatedAt: o.updatedAt,
    entries,
  };
}
