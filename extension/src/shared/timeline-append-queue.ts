import type { InteractionTimelineEntryV1 } from "./types";
import { enqueueRuntimeMessage } from "./extension-message-queue";
import { timelineEntryFingerprint } from "./timeline-session-store";

const sent = new Set<string>();
const SENT_MAX = 2500;
let pending: InteractionTimelineEntryV1[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 100;

/**
 * Agenda envio ao SW (debounce). Usado a partir de cada snapshot do page-bridge.
 */
export function scheduleTimelineAppendToServiceWorker(entries: InteractionTimelineEntryV1[]): void {
  const toSend: InteractionTimelineEntryV1[] = [];
  for (const e of entries) {
    const f = timelineEntryFingerprint(e);
    if (sent.has(f)) continue;
    sent.add(f);
    toSend.push(e);
  }
  if (sent.size > SENT_MAX) sent.clear();
  if (!toSend.length) return;
  pending.push(...toSend);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const batch = pending;
    pending = [];
    if (!batch.length) return;
    void enqueueRuntimeMessage(() =>
      chrome.runtime.sendMessage({ type: "QAF_TIMELINE_APPEND", entries: batch }).then(() => undefined),
    );
  }, DEBOUNCE_MS);
}

/**
 * Garante que não há APPENDs pendentes antes de outra mensagem crítica (ex.: captura de ecrã).
 */
export async function flushTimelineAppendQueueNow(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const batch = pending;
  pending = [];
  if (!batch.length) return;
  await enqueueRuntimeMessage(() =>
    chrome.runtime.sendMessage({ type: "QAF_TIMELINE_APPEND", entries: batch }).then(() => undefined),
  );
}
