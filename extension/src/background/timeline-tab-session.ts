/**
 * Sessão de timeline por aba no service worker (MV3) + espelho em chrome.storage.session.
 */
import { CAPTURE_LIMITS } from "../shared/context-limits";
import {
  appendEntriesToSession,
  emptyTimelineSession,
  expireTimelineSessionIfStale,
  parseTimelineTabSession,
  type TimelineTabSessionV1,
} from "../shared/timeline-session-store";
import type { InteractionTimelineEntryV1 } from "../shared/types";

export function qafTimelineStorageKey(tabId: number): string {
  return `qafTimelineV1_${tabId}`;
}

const memory = new Map<number, TimelineTabSessionV1>();

async function readSession(tabId: number): Promise<TimelineTabSessionV1> {
  const now = Date.now();
  const ttl = CAPTURE_LIMITS.swTimelineSessionTtlMs;
  const mem = memory.get(tabId);
  if (mem) {
    const e = expireTimelineSessionIfStale(mem, now, ttl);
    if (e !== mem) await writeSession(tabId, e);
    return e;
  }
  const key = qafTimelineStorageKey(tabId);
  const bag = await chrome.storage.session.get(key);
  const parsed = parseTimelineTabSession(bag[key]);
  const base = parsed ?? emptyTimelineSession(new Date(now).toISOString());
  const expired = expireTimelineSessionIfStale(base, now, ttl);
  memory.set(tabId, expired);
  if (expired !== base) await writeSession(tabId, expired);
  return expired;
}

async function writeSession(tabId: number, session: TimelineTabSessionV1): Promise<void> {
  memory.set(tabId, session);
  const key = qafTimelineStorageKey(tabId);
  await chrome.storage.session.set({ [key]: session });
}

export async function timelineSessionStart(tabId: number, sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  const prev = await readSession(tabId);
  const next: TimelineTabSessionV1 = {
    ...prev,
    sessionId: sessionId || prev.sessionId,
    startedAt: prev.startedAt || now,
    updatedAt: now,
    // Não limpar entries — histórico antes de abrir o painel deve persistir na mesma aba.
  };
  await writeSession(tabId, next);
}

export async function timelineSessionAppend(
  tabId: number,
  entries: InteractionTimelineEntryV1[],
): Promise<void> {
  if (!entries.length) return;
  const nowIso = new Date().toISOString();
  let s = await readSession(tabId);
  s = expireTimelineSessionIfStale(s, Date.now(), CAPTURE_LIMITS.swTimelineSessionTtlMs);
  const next = appendEntriesToSession(s, entries, nowIso, CAPTURE_LIMITS.swTimelineSessionMaxEntries);
  await writeSession(tabId, next);
}

export async function timelineSessionGetForSubmit(tabId: number): Promise<InteractionTimelineEntryV1[]> {
  const s = await readSession(tabId);
  return s.entries.slice();
}

export async function timelineSessionEnd(tabId: number): Promise<void> {
  memory.delete(tabId);
  await chrome.storage.session.remove(qafTimelineStorageKey(tabId));
}
