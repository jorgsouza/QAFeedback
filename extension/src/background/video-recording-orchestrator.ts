import { loadSettings } from "../shared/storage";

const OFFSCREEN_HTML = "offscreen.html";

const VIDEO_REC_SESSION_PREFIX = "qafVideoRecV1_";

/** Vídeo pronto para Jira (base64) — mesmo prefixo que `offscreen.ts`. */
const PENDING_JIRA_VIDEO_TAB_PREFIX = "qafPendingVideoV1_tab_";

export function pendingJiraVideoSessionKey(tabId: number): string {
  return `${PENDING_JIRA_VIDEO_TAB_PREFIX}${tabId}`;
}

export async function clearPendingJiraVideoForTab(tabId: number | null | undefined): Promise<void> {
  if (tabId == null || !Number.isFinite(tabId)) return;
  const pk = pendingJiraVideoSessionKey(tabId);
  try {
    const bag = await chrome.storage.session.get(pk);
    const top = bag[pk] as { v?: number; parts?: number } | undefined;
    const keys: string[] = [pk];
    if (top?.v === 2 && typeof top.parts === "number") {
      const n = Math.min(Math.max(0, top.parts), 256);
      for (let i = 0; i < n; i++) keys.push(`${pk}_part_${i}`);
    }
    await chrome.storage.session.remove(keys);
  } catch {
    await chrome.storage.session.remove(pk).catch(() => {});
  }
}

type StoredPendingJiraVideoV1 = {
  v: 1;
  fileName: string;
  mimeType: string;
  base64: string;
};

type StoredPendingJiraVideoMetaV2 = {
  v: 2;
  fileName: string;
  mimeType: string;
  parts: number;
};

/** Vídeo único em session; acima do limite usa várias chaves `_part_N` (v:2). */
const PENDING_VIDEO_SINGLE_MAX_CHARS = 900_000;
const PENDING_VIDEO_PART_CHARS = Math.floor(750_000 / 4) * 4;

export async function loadPendingJiraVideoForTab(tabId: number): Promise<{
  fileName: string;
  mimeType: string;
  base64: string;
} | null> {
  const pk = pendingJiraVideoSessionKey(tabId);
  const bag = await chrome.storage.session.get(pk);
  const top = bag[pk] as StoredPendingJiraVideoV1 | StoredPendingJiraVideoMetaV2 | undefined;
  if (!top || typeof top !== "object") return null;
  if (top.v === 1) {
    const o = top as StoredPendingJiraVideoV1;
    if (o.fileName && o.base64) {
      return { fileName: o.fileName, mimeType: o.mimeType || "video/webm", base64: o.base64 };
    }
    return null;
  }
  if (top.v === 2) {
    const o = top as StoredPendingJiraVideoMetaV2;
    if (!o.fileName || typeof o.parts !== "number" || o.parts < 1) return null;
    const n = Math.min(o.parts, 256);
    const keys = Array.from({ length: n }, (_, i) => `${pk}_part_${i}`);
    const partsBag = await chrome.storage.session.get(keys);
    let base64 = "";
    for (let i = 0; i < n; i++) {
      const chunk = partsBag[`${pk}_part_${i}`];
      if (typeof chunk !== "string") return null;
      base64 += chunk;
    }
    return { fileName: o.fileName, mimeType: o.mimeType || "video/webm", base64 };
  }
  return null;
}

function videoRecSessionKey(tabId: number): string {
  return `${VIDEO_REC_SESSION_PREFIX}${tabId}`;
}

type StoredVideoRecV1 = {
  v: 1;
  sessionId: string;
  tabId: number;
  startedAtMs: number;
  maxDurationSec: number;
};

async function persistVideoRecordingSession(
  tabId: number,
  data: { sessionId: string; tabId: number; startedAtMs: number; maxDurationSec: number },
): Promise<void> {
  const payload: StoredVideoRecV1 = { v: 1, ...data };
  await chrome.storage.session.set({ [videoRecSessionKey(tabId)]: payload });
}

async function clearVideoRecordingSessionStorage(tabId: number | null | undefined): Promise<void> {
  if (tabId == null || !Number.isFinite(tabId)) return;
  await chrome.storage.session.remove(videoRecSessionKey(tabId)).catch(() => {});
}

async function readVideoRecordingSession(tabId: number): Promise<StoredVideoRecV1 | null> {
  const k = videoRecSessionKey(tabId);
  const bag = await chrome.storage.session.get(k);
  const raw = bag[k];
  if (!raw || typeof raw !== "object") return null;
  const o = raw as StoredVideoRecV1;
  if (o.v !== 1 || typeof o.sessionId !== "string") return null;
  return o;
}

type ExpectedPhase = "started" | "stopped";

type SignalWaiter = {
  expected: ExpectedPhase;
  resolve: (msg: Record<string, unknown>) => void;
  reject: (e: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const signalWaiters = new Map<string, SignalWaiter>();

/** Offscreen não tem `chrome.storage`; o SW recebe base64 em partes e grava em session. */
type VideoBase64Accumulator = {
  tabId: number;
  total: number;
  parts: string[];
};

const videoBase64Accumulators = new Map<string, VideoBase64Accumulator>();

function clearVideoBase64Accumulator(sessionId: string): void {
  videoBase64Accumulators.delete(sessionId);
}

function rejectStoppedWaiterIfPresent(sessionId: string, errMsg: string): void {
  const w = signalWaiters.get(sessionId);
  if (!w) return;
  clearTimeout(w.timeoutId);
  signalWaiters.delete(sessionId);
  w.reject(new Error(errMsg));
}

/** Chamado pelo SW ao receber cada parte do base64 vinda do offscreen. */
export function routeOffscreenVideoBase64Chunk(message: Record<string, unknown>): boolean {
  if (message?.type !== "QAF_OFFSCREEN_VIDEO_BASE64_CHUNK") return false;
  const sessionId = String(message.sessionId ?? "");
  if (!sessionId) return true;
  const tabId = Number(message.tabId);
  const index = Number(message.index);
  const total = Number(message.total);
  const chunk = typeof message.chunk === "string" ? message.chunk : "";
  if (!Number.isFinite(tabId) || !Number.isFinite(index) || !Number.isFinite(total) || total < 1 || index < 0 || index >= total) {
    clearVideoBase64Accumulator(sessionId);
    rejectStoppedWaiterIfPresent(sessionId, "Parte de vídeo inválida.");
    return true;
  }
  let acc = videoBase64Accumulators.get(sessionId);
  if (!acc) {
    acc = { tabId, total, parts: new Array<string>(total) };
    videoBase64Accumulators.set(sessionId, acc);
  }
  if (acc.total !== total || acc.tabId !== tabId) {
    clearVideoBase64Accumulator(sessionId);
    rejectStoppedWaiterIfPresent(sessionId, "Sessão de transferência do vídeo inconsistente.");
    return true;
  }
  acc.parts[index] = chunk;
  return true;
}

/** Último passo: junta partes, grava `chrome.storage.session`, resolve o waiter «stopped». */
export async function routeOffscreenVideoBase64Commit(message: Record<string, unknown>): Promise<void> {
  const sessionId = String(message.sessionId ?? "");
  if (!sessionId) {
    throw new Error("sessionId em falta.");
  }
  const tabId = Number(message.tabId);
  const acc = videoBase64Accumulators.get(sessionId);
  if (!acc || acc.tabId !== tabId) {
    rejectStoppedWaiterIfPresent(sessionId, "Vídeo: dados em falta (reinicie a gravação).");
    throw new Error("Chunks em falta.");
  }
  if (!acc.parts.every((p) => typeof p === "string")) {
    clearVideoBase64Accumulator(sessionId);
    rejectStoppedWaiterIfPresent(sessionId, "Transferência do vídeo incompleta.");
    throw new Error("Partes em falta.");
  }
  const base64 = acc.parts.join("");
  clearVideoBase64Accumulator(sessionId);
  const fileName =
    String(message.fileName ?? "").trim() || `qa-recording-${Date.now()}.webm`;
  const mimeType = String(message.mimeType ?? "video/webm").trim() || "video/webm";
  const durationMs = Number(message.durationMs ?? 0);
  const sizeBytes = Number(message.sizeBytes ?? 0);
  const pendingKey = pendingJiraVideoSessionKey(tabId);
  if (base64.length <= PENDING_VIDEO_SINGLE_MAX_CHARS) {
    await chrome.storage.session.set({
      [pendingKey]: { v: 1, fileName, mimeType, base64 },
    });
  } else {
    const partStrs: string[] = [];
    for (let i = 0; i < base64.length; i += PENDING_VIDEO_PART_CHARS) {
      partStrs.push(base64.slice(i, i + PENDING_VIDEO_PART_CHARS));
    }
    const meta: StoredPendingJiraVideoMetaV2 = {
      v: 2,
      fileName,
      mimeType,
      parts: partStrs.length,
    };
    const batch: Record<string, unknown> = { [pendingKey]: meta };
    for (let i = 0; i < partStrs.length; i++) {
      batch[`${pendingKey}_part_${i}`] = partStrs[i];
    }
    await chrome.storage.session.set(batch);
  }
  const w = signalWaiters.get(sessionId);
  if (w && w.expected === "stopped") {
    clearTimeout(w.timeoutId);
    signalWaiters.delete(sessionId);
    w.resolve({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "stopped",
      sessionId,
      durationMs,
      sizeBytes,
      fileName,
      mimeType,
    });
  }
}

export function routeOffscreenVideoSignal(message: Record<string, unknown>): void {
  if (message?.type !== "QAF_OFFSCREEN_VIDEO_SIGNAL") return;
  const sessionId = String(message.sessionId ?? "");
  if (!sessionId) return;
  const w = signalWaiters.get(sessionId);
  if (!w) return;
  const phase = String(message.phase ?? "");
  if (phase === "error") {
    clearTimeout(w.timeoutId);
    signalWaiters.delete(sessionId);
    w.reject(new Error(String(message.message ?? message.code ?? "Erro na gravação")));
    return;
  }
  if (phase === w.expected) {
    clearTimeout(w.timeoutId);
    signalWaiters.delete(sessionId);
    w.resolve(message);
  }
}

function registerSignalWait(sessionId: string, expected: ExpectedPhase, ms: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (signalWaiters.get(sessionId)?.timeoutId === timeoutId) {
        signalWaiters.delete(sessionId);
      }
      reject(new Error("Tempo esgotado ao comunicar com o gravador."));
    }, ms);
    signalWaiters.set(sessionId, {
      expected,
      resolve,
      reject,
      timeoutId,
    });
  });
}

function isUrlInjectableForCapture(url: string | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  if (u.startsWith("chrome://")) return false;
  if (u.startsWith("chrome-extension://")) return false;
  if (u.startsWith("edge://")) return false;
  if (u.startsWith("about:")) return false;
  if (u.startsWith("devtools://")) return false;
  if (u.startsWith("https://chrome.google.com/webstore")) return false;
  if (u.startsWith("https://chromewebstore.google.com")) return false;
  return u.startsWith("http://") || u.startsWith("https://");
}

async function ensureOffscreenDocument(): Promise<void> {
  if (typeof chrome.runtime.getContexts === "function") {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    });
    if (contexts.length > 0) return;
  }
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_HTML,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Gravar o viewport da aba em WebM para evidência de QA anexada no Jira.",
  });
}

function clampViewportMaxSec(n: number): number {
  if (!Number.isFinite(n)) return 60;
  return Math.max(30, Math.min(90, Math.round(n)));
}

export type VideoStartResult =
  | { ok: true; sessionId: string; startedAt: string; maxDurationSec: number; reattached?: boolean }
  | { ok: false; code: string; message: string };

export type VideoStopResult =
  | {
      ok: true;
      /** Metadados para a UI; o base64 fica em `chrome.storage.session` quando `pendingInSession` é true. */
      attachment: { fileName: string; mimeType: string; base64: string };
      durationMs: number;
      sizeBytes: number;
      pendingInSession: boolean;
    }
  | { ok: false; code: string; message: string };

let currentSessionId: string | null = null;
/** Separador cuja captura está ativa no offscreen (uma gravação global por extensão). */
let recordingTabId: number | null = null;

export function getActiveVideoSessionId(): string | null {
  return currentSessionId;
}

export async function getViewportRecordingStateForTab(tabId: number | undefined): Promise<{
  active: boolean;
  sessionId?: string;
  startedAtMs?: number;
  maxDurationSec?: number;
}> {
  if (tabId == null || !Number.isFinite(tabId)) return { active: false };
  if (!currentSessionId || recordingTabId !== tabId) {
    const orphan = await readVideoRecordingSession(tabId);
    if (orphan) await clearVideoRecordingSessionStorage(tabId);
    return { active: false };
  }
  const snap = await readVideoRecordingSession(tabId);
  if (snap && snap.sessionId !== currentSessionId) {
    await clearVideoRecordingSessionStorage(tabId);
    return { active: false };
  }
  const startedAtMs = snap?.startedAtMs ?? Date.now();
  const maxDurationSec = snap?.maxDurationSec ?? 60;
  return {
    active: true,
    sessionId: currentSessionId,
    startedAtMs,
    maxDurationSec,
  };
}

/** Aborta só se este separador for o que está a gravar (útil após navegação quando o React perdeu o sessionId). */
export async function abortViewportRecordingForTab(tabId: number | undefined): Promise<void> {
  if (tabId == null || !Number.isFinite(tabId)) return;
  await clearPendingJiraVideoForTab(tabId);
  if (recordingTabId === tabId) {
    await abortViewportRecording();
  }
}

export async function startViewportRecording(tabId: number | undefined): Promise<VideoStartResult> {
  const settings = await loadSettings();
  if (!settings.enableViewportRecording) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Ative «Gravação viewport (WebM)» nas opções da extensão.",
    };
  }
  if (tabId == null || !Number.isFinite(tabId)) {
    return { ok: false, code: "NO_TAB", message: "Separador desconhecido." };
  }
  if (currentSessionId != null) {
    if (recordingTabId === tabId) {
      const snap = await readVideoRecordingSession(tabId);
      const maxDurationSec =
        snap?.maxDurationSec ?? clampViewportMaxSec((await loadSettings()).viewportRecordingMaxSec ?? 60);
      const startedAtMs = snap?.startedAtMs ?? Date.now();
      console.info("[QA Feedback] video recording reattach same tab", { sessionId: currentSessionId, tabId });
      return {
        ok: true,
        sessionId: currentSessionId,
        startedAt: new Date(startedAtMs).toISOString(),
        maxDurationSec,
        reattached: true,
      };
    }
    return {
      ok: false,
      code: "ALREADY_RECORDING",
      message: "Já existe uma gravação noutro separador. Pare ou cancele antes de iniciar outra.",
    };
  }
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return { ok: false, code: "TAB_GONE", message: "Não foi possível aceder ao separador." };
  }
  const pageUrl = tab.url ?? tab.pendingUrl ?? "";
  if (!isUrlInjectableForCapture(pageUrl)) {
    return {
      ok: false,
      code: "PAGE_BLOCKED",
      message:
        "Este URL não permite captura (ex.: chrome://, Web Store). Abra um site http(s) e tente de novo.",
    };
  }
  await clearPendingJiraVideoForTab(tabId);
  try {
    await ensureOffscreenDocument();
  } catch (e) {
    return {
      ok: false,
      code: "OFFSCREEN_FAILED",
      message: e instanceof Error ? e.message : "Falha ao preparar o gravador.",
    };
  }
  const streamId = await new Promise<string>((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
      const err = chrome.runtime.lastError;
      if (err?.message) {
        reject(new Error(err.message));
        return;
      }
      if (!id) {
        reject(new Error("streamId vazio."));
        return;
      }
      resolve(id);
    });
  });
  const sessionId = crypto.randomUUID();
  const maxDurationSec = clampViewportMaxSec(settings.viewportRecordingMaxSec ?? 60);
  const maxWindowSec = 90;
  const startedPromise = registerSignalWait(sessionId, "started", 25_000);
  try {
    await chrome.runtime.sendMessage({
      type: "QAF_OFFSCREEN_VIDEO_START",
      streamId,
      sessionId,
      maxWindowSec,
      videoBitsPerSecond: 800_000,
    });
  } catch (e) {
    signalWaiters.delete(sessionId);
    return {
      ok: false,
      code: "SEND_FAILED",
      message: e instanceof Error ? e.message : "Falha ao iniciar gravação.",
    };
  }
  try {
    await startedPromise;
  } catch (e) {
    void chrome.runtime.sendMessage({ type: "QAF_OFFSCREEN_VIDEO_ABORT", sessionId }).catch(() => {});
    return {
      ok: false,
      code: "START_TIMEOUT",
      message: e instanceof Error ? e.message : "Tempo esgotado ao iniciar.",
    };
  }
  currentSessionId = sessionId;
  recordingTabId = tabId;
  const startedAtMs = Date.now();
  await persistVideoRecordingSession(tabId, {
    sessionId,
    tabId,
    startedAtMs,
    maxDurationSec,
  });
  console.info("[QA Feedback] video recording started", { sessionId, tabId, maxDurationSec });
  return {
    ok: true,
    sessionId,
    startedAt: new Date(startedAtMs).toISOString(),
    maxDurationSec,
  };
}

export async function stopViewportRecording(sessionId: string): Promise<VideoStopResult> {
  if (!sessionId || sessionId !== currentSessionId) {
    return {
      ok: false,
      code: "BAD_SESSION",
      message: "Sessão de gravação inválida. Inicie uma nova gravação.",
    };
  }
  const tabForVideo = recordingTabId;
  if (tabForVideo == null || !Number.isFinite(tabForVideo)) {
    return { ok: false, code: "NO_TAB", message: "Separador da gravação desconhecido." };
  }
  const stoppedPromise = registerSignalWait(sessionId, "stopped", 120_000);
  try {
    await chrome.runtime.sendMessage({
      type: "QAF_OFFSCREEN_VIDEO_STOP",
      sessionId,
      tabId: tabForVideo,
    });
  } catch (e) {
    signalWaiters.delete(sessionId);
    clearVideoBase64Accumulator(sessionId);
    const tabClear = recordingTabId;
    currentSessionId = null;
    recordingTabId = null;
    void clearVideoRecordingSessionStorage(tabClear);
    void clearPendingJiraVideoForTab(tabForVideo);
    return {
      ok: false,
      code: "SEND_FAILED",
      message: e instanceof Error ? e.message : "Falha ao parar gravação.",
    };
  }
  try {
    const msg = await stoppedPromise;
    const tabClear = recordingTabId;
    currentSessionId = null;
    recordingTabId = null;
    await clearVideoRecordingSessionStorage(tabClear);
    const loaded = await loadPendingJiraVideoForTab(tabForVideo);
    if (!loaded?.fileName || !loaded.base64) {
      return { ok: false, code: "NO_ATTACHMENT", message: "Resposta de gravação incompleta." };
    }
    const durationMs = Number(msg.durationMs ?? 0);
    const sizeBytes = Number(msg.sizeBytes ?? 0);
    console.info("[QA Feedback] video recording stopped", { sessionId, durationMs, sizeBytes });
    return {
      ok: true,
      attachment: {
        fileName: loaded.fileName,
        mimeType: loaded.mimeType || "video/webm",
        base64: "",
      },
      durationMs,
      sizeBytes,
      pendingInSession: true,
    };
  } catch (e) {
    clearVideoBase64Accumulator(sessionId);
    const tabClear = recordingTabId;
    currentSessionId = null;
    recordingTabId = null;
    await clearVideoRecordingSessionStorage(tabClear);
    void clearPendingJiraVideoForTab(tabForVideo);
    return {
      ok: false,
      code: "STOP_ERROR",
      message: e instanceof Error ? e.message : "Falha ao finalizar vídeo.",
    };
  }
}

export async function abortViewportRecording(sessionId?: string): Promise<void> {
  const sid = sessionId && sessionId === currentSessionId ? sessionId : currentSessionId;
  const tabClear = recordingTabId;
  currentSessionId = null;
  recordingTabId = null;
  if (sid) clearVideoBase64Accumulator(sid);
  await clearVideoRecordingSessionStorage(tabClear);
  await clearPendingJiraVideoForTab(tabClear);
  const w = sid ? signalWaiters.get(sid) : undefined;
  if (w) {
    clearTimeout(w.timeoutId);
    signalWaiters.delete(sid!);
    w.reject(new Error("Gravação cancelada."));
  }
  if (sid) {
    try {
      await chrome.runtime.sendMessage({ type: "QAF_OFFSCREEN_VIDEO_ABORT", sessionId: sid });
    } catch {
      /* ignore */
    }
  }
  console.info("[QA Feedback] video recording aborted", { sessionId: sid ?? null });
}
