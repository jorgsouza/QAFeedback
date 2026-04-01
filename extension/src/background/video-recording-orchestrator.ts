import { base64ToUint8Array } from "../shared/base64-to-bytes";
import { coerceToUint8Array } from "../shared/coerce-binary";
import { DEFAULT_VIEWPORT_RECORDING_MAX_SEC, loadSettings } from "../shared/storage";
import {
  videoDbgInfo,
  videoDbgWarn,
  videoHexHead,
  videoSessionShort,
} from "../shared/video-debug-log";
import { bytesMatchWebmEbmlSignature } from "../shared/webm-file-signature";

const OFFSCREEN_HTML = "offscreen.html";

const VIDEO_REC_SESSION_PREFIX = "qafVideoRecV1_";

/** Vídeo pronto para Jira (bytes em session, v:3) — mesmo prefixo que `offscreen.ts`. */
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

type StoredPendingJiraVideoV3 = {
  v: 3;
  fileName: string;
  mimeType: string;
  byteLength: number;
  /** Preferido (structured clone fiável em `chrome.storage.session`). */
  bytes?: Uint8Array;
  /** Legado: só `ArrayBuffer`. */
  data?: ArrayBuffer;
};

export async function loadPendingJiraVideoForTab(tabId: number): Promise<{
  fileName: string;
  mimeType: string;
  base64?: string;
  binary?: Uint8Array;
} | null> {
  const pk = pendingJiraVideoSessionKey(tabId);
  const bag = await chrome.storage.session.get(pk);
  const top = bag[pk] as
    | StoredPendingJiraVideoV1
    | StoredPendingJiraVideoMetaV2
    | StoredPendingJiraVideoV3
    | undefined;
  if (!top || typeof top !== "object") return null;
  if (top.v === 3) {
    const o = top as StoredPendingJiraVideoV3;
    if (!o.fileName) return null;
    const fromBytes = coerceToUint8Array(o.bytes as unknown);
    if (fromBytes && fromBytes.byteLength > 0) {
      const copy = new Uint8Array(fromBytes.byteLength);
      copy.set(fromBytes);
      return {
        fileName: o.fileName,
        mimeType: o.mimeType || "video/webm",
        binary: copy,
      };
    }
    const fromData = coerceToUint8Array(o.data as unknown);
    if (fromData && fromData.byteLength > 0) {
      const copy = new Uint8Array(fromData.byteLength);
      copy.set(fromData);
      return {
        fileName: o.fileName,
        mimeType: o.mimeType || "video/webm",
        binary: copy,
      };
    }
    return null;
  }
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

/** Offscreen não tem `chrome.storage`; o SW recebe bytes em partes e grava em session (sem base64). */
type VideoBytesAccumulator = {
  tabId: number;
  total: number;
  parts: Uint8Array[];
};

const videoBytesAccumulators = new Map<string, VideoBytesAccumulator>();

function clearVideoBytesAccumulator(sessionId: string): void {
  videoBytesAccumulators.delete(sessionId);
}

function rejectStoppedWaiterIfPresent(sessionId: string, errMsg: string): void {
  const w = signalWaiters.get(sessionId);
  if (!w) return;
  clearTimeout(w.timeoutId);
  signalWaiters.delete(sessionId);
  w.reject(new Error(errMsg));
}

/** Chamado pelo SW ao receber cada parte binária vinda do offscreen. */
export function routeOffscreenVideoBytesChunk(message: Record<string, unknown>): boolean {
  if (message?.type !== "QAF_OFFSCREEN_VIDEO_BYTES_CHUNK") return false;
  const sessionId = String(message.sessionId ?? "");
  if (!sessionId) return true;
  const tabId = Number(message.tabId);
  const index = Number(message.index);
  const total = Number(message.total);
  const b64Field = typeof message.base64 === "string" ? message.base64 : "";
  const badIdxReason = ((): string | null => {
    if (!Number.isFinite(tabId)) return "invalid_tabId";
    if (!Number.isFinite(index)) return "invalid_index";
    if (!Number.isFinite(total)) return "invalid_total";
    if (total < 1) return "total_lt_1";
    if (index < 0 || index >= total) return "index_out_of_range";
    return null;
  })();
  if (badIdxReason !== null) {
    videoDbgWarn("sw ← chunk rejeitado (ver motivo)", {
      reason: badIdxReason,
      sessionId: videoSessionShort(sessionId),
      tabId,
      index,
      total,
    });
    clearVideoBytesAccumulator(sessionId);
    rejectStoppedWaiterIfPresent(sessionId, "Parte de vídeo inválida.");
    return true;
  }
  let rawChunk: Uint8Array | null = null;
  if (b64Field.length > 0) {
    try {
      rawChunk = base64ToUint8Array(b64Field);
    } catch {
      rawChunk = null;
    }
  }
  if (rawChunk == null) {
    rawChunk = coerceToUint8Array(message.arrayBuffer ?? message.bytes);
  }
  if (rawChunk == null) {
    const badReason = b64Field.length > 0 ? "base64_decode_failed" : "payload_not_binary";
    const rawPayload = message.arrayBuffer ?? message.bytes;
    videoDbgWarn("sw ← chunk rejeitado (ver motivo)", {
      reason: badReason,
      sessionId: videoSessionShort(sessionId),
      tabId,
      index,
      total,
      base64Chars: b64Field.length,
      payloadTags: {
        hasBase64: b64Field.length > 0,
        hasArrayBuffer: message.arrayBuffer != null,
        hasBytes: message.bytes != null,
        rawTag:
          rawPayload == null ? "nullish" : Object.prototype.toString.call(rawPayload),
      },
    });
    clearVideoBytesAccumulator(sessionId);
    rejectStoppedWaiterIfPresent(sessionId, "Parte de vídeo inválida.");
    return true;
  }
  const chunkCopy = new Uint8Array(rawChunk.byteLength);
  chunkCopy.set(rawChunk);
  let acc = videoBytesAccumulators.get(sessionId);
  if (!acc) {
    acc = { tabId, total, parts: new Array<Uint8Array>(total) };
    videoBytesAccumulators.set(sessionId, acc);
  }
  if (acc.total !== total || acc.tabId !== tabId) {
    videoDbgWarn("sw ← chunk sessão inconsistente", {
      sessionId: videoSessionShort(sessionId),
      expectedTab: acc.tabId,
      gotTab: tabId,
      expectedTotal: acc.total,
      gotTotal: total,
    });
    clearVideoBytesAccumulator(sessionId);
    rejectStoppedWaiterIfPresent(sessionId, "Sessão de transferência do vídeo inconsistente.");
    return true;
  }
  acc.parts[index] = chunkCopy;
  videoDbgInfo("sw ← chunk ok", {
    sessionId: videoSessionShort(sessionId),
    tabId,
    chunk: `${index + 1}/${total}`,
    bytes: chunkCopy.byteLength,
    transport: b64Field.length > 0 ? "base64" : "binary",
    ...(index === 0 ? { headHex: videoHexHead(chunkCopy, 8) } : {}),
  });
  return true;
}

function isVideoBytesAccumulatorComplete(parts: Uint8Array[], total: number): boolean {
  if (parts.length !== total) return false;
  for (let i = 0; i < total; i++) {
    if (!(parts[i] instanceof Uint8Array)) return false;
  }
  return true;
}

function concatVideoBytesParts(parts: Uint8Array[], total: number): Uint8Array {
  if (parts.length !== total) return new Uint8Array(0);
  let len = 0;
  for (let i = 0; i < total; i++) len += parts[i]!.byteLength;
  const out = new Uint8Array(len);
  let offset = 0;
  for (let i = 0; i < total; i++) {
    const p = parts[i]!;
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

/** Último passo: junta partes, grava `chrome.storage.session`, resolve o waiter «stopped». */
export async function routeOffscreenVideoBytesCommit(message: Record<string, unknown>): Promise<void> {
  const sessionId = String(message.sessionId ?? "");
  if (!sessionId) {
    throw new Error("sessionId em falta.");
  }
  const tabId = Number(message.tabId);
  videoDbgInfo("sw ← commit pedido", {
    sessionId: videoSessionShort(sessionId),
    tabId,
    byteLengthMsg: message.byteLength,
  });
  const acc = videoBytesAccumulators.get(sessionId);
  if (!acc || acc.tabId !== tabId) {
    videoDbgWarn("sw commit falhou: acumulador em falta ou tabId", {
      sessionId: videoSessionShort(sessionId),
      tabId,
      hadAcc: Boolean(acc),
      accTab: acc?.tabId,
    });
    rejectStoppedWaiterIfPresent(sessionId, "Vídeo: dados em falta (reinicie a gravação).");
    throw new Error("Chunks em falta.");
  }
  if (!isVideoBytesAccumulatorComplete(acc.parts, acc.total)) {
    const missing: number[] = [];
    for (let i = 0; i < acc.total; i++) {
      if (!(acc.parts[i] instanceof Uint8Array)) missing.push(i);
    }
    videoDbgWarn("sw commit falhou: partes em falta", {
      sessionId: videoSessionShort(sessionId),
      total: acc.total,
      missingIndices: missing,
    });
    clearVideoBytesAccumulator(sessionId);
    rejectStoppedWaiterIfPresent(sessionId, "Transferência do vídeo incompleta.");
    throw new Error("Partes em falta.");
  }
  const expectedByteLength = Number(message.byteLength ?? NaN);
  const decoded = concatVideoBytesParts(acc.parts, acc.total);
  clearVideoBytesAccumulator(sessionId);
  if (
    Number.isFinite(expectedByteLength) &&
    expectedByteLength >= 0 &&
    decoded.byteLength !== expectedByteLength
  ) {
    videoDbgWarn("sw commit falhou: tamanho bytes", {
      sessionId: videoSessionShort(sessionId),
      expected: expectedByteLength,
      got: decoded.byteLength,
    });
    rejectStoppedWaiterIfPresent(
      sessionId,
      "Vídeo: dados truncados na transferência. Grave de novo.",
    );
    throw new Error("VIDEO_BYTE_LENGTH_MISMATCH");
  }
  const fileName =
    String(message.fileName ?? "").trim() || `qa-recording-${Date.now()}.webm`;
  const mimeType = String(message.mimeType ?? "video/webm").trim() || "video/webm";
  const durationMs = Number(message.durationMs ?? 0);
  const sizeBytes = Number(message.sizeBytes ?? 0);
  const pendingKey = pendingJiraVideoSessionKey(tabId);
  if (decoded.byteLength === 0) {
    videoDbgWarn("sw commit falhou: decodificado vazio", { sessionId: videoSessionShort(sessionId) });
    rejectStoppedWaiterIfPresent(sessionId, "Vídeo vazio.");
    throw new Error("VIDEO_EMPTY");
  }
  if (!bytesMatchWebmEbmlSignature(decoded)) {
    videoDbgWarn("sw commit falhou: assinatura EBML", {
      sessionId: videoSessionShort(sessionId),
      byteLength: decoded.byteLength,
      headHex: videoHexHead(decoded, 16),
    });
    rejectStoppedWaiterIfPresent(
      sessionId,
      "Vídeo corrompido ou inválido após transferência (não é WebM/Matroska). Grave de novo.",
    );
    throw new Error("VIDEO_BAD_MAGIC");
  }
  const owned = new Uint8Array(decoded.byteLength);
  owned.set(decoded);
  const payload: StoredPendingJiraVideoV3 = {
    v: 3,
    fileName,
    mimeType,
    byteLength: owned.byteLength,
    bytes: owned,
  };
  await chrome.storage.session.set({ [pendingKey]: payload });
  videoDbgInfo("sw ← commit OK (gravado em session.storage)", {
    sessionId: videoSessionShort(sessionId),
    tabId,
    pendingKey,
    fileName,
    byteLength: owned.byteLength,
    headHex: videoHexHead(owned, 8),
    durationMs,
    blobSizeReported: sizeBytes,
  });
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
  const phase = String(message.phase ?? "");
  if (phase === "error") {
    videoDbgWarn("offscreen → signal erro", {
      sessionId: videoSessionShort(sessionId),
      code: String(message.code ?? ""),
      detail: String(message.message ?? ""),
    });
  }
  const w = signalWaiters.get(sessionId);
  if (!w) return;
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

/** Evita duas chamadas em paralelo a «iniciar»: ambas viam `currentSessionId === null` e geravam dois `sessionId` no offscreen (ficheiro corrompido). */
let viewportRecordingStartChain: Promise<void> = Promise.resolve();

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
  const maxDurationSec = snap?.maxDurationSec ?? DEFAULT_VIEWPORT_RECORDING_MAX_SEC;
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
  const prev = viewportRecordingStartChain;
  let release!: () => void;
  viewportRecordingStartChain = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  try {
    return await startViewportRecordingSerialized(tabId);
  } finally {
    release();
  }
}

async function startViewportRecordingSerialized(tabId: number | undefined): Promise<VideoStartResult> {
  const settings = await loadSettings();
  if (!settings.enableViewportRecording) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Gravação viewport indisponível (estado interno). Recarregue a extensão.",
    };
  }
  if (tabId == null || !Number.isFinite(tabId)) {
    return { ok: false, code: "NO_TAB", message: "Separador desconhecido." };
  }
  if (currentSessionId != null) {
    if (recordingTabId === tabId) {
      const snap = await readVideoRecordingSession(tabId);
      const maxDurationSec =
        snap?.maxDurationSec ??
        clampViewportMaxSec((await loadSettings()).viewportRecordingMaxSec ?? DEFAULT_VIEWPORT_RECORDING_MAX_SEC);
      const startedAtMs = snap?.startedAtMs ?? Date.now();
      videoDbgInfo("recording reattach (mesmo tab)", {
        sessionId: currentSessionId,
        tabId,
      });
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
  videoBytesAccumulators.clear();
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
  const maxDurationSec = clampViewportMaxSec(
    settings.viewportRecordingMaxSec ?? DEFAULT_VIEWPORT_RECORDING_MAX_SEC,
  );
  const startedPromise = registerSignalWait(sessionId, "started", 25_000);
  try {
    await chrome.runtime.sendMessage({
      type: "QAF_OFFSCREEN_VIDEO_START",
      streamId,
      sessionId,
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
  videoDbgInfo("recording started (SW)", { sessionId, tabId, maxDurationSec });
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
    clearVideoBytesAccumulator(sessionId);
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
    const hasVideoBytes =
      (loaded?.binary?.byteLength ?? 0) > 0 || (loaded?.base64 != null && loaded.base64.length > 0);
    if (!loaded?.fileName || !hasVideoBytes) {
      const pk = pendingJiraVideoSessionKey(tabForVideo);
      const snap = await chrome.storage.session.get(pk);
      const top = snap[pk] as Record<string, unknown> | undefined;
      const bytesTag =
        top && "bytes" in top && top.bytes != null
          ? Object.prototype.toString.call(top.bytes)
          : "∅";
      const dataTag =
        top && "data" in top && top.data != null ? Object.prototype.toString.call(top.data) : "∅";
      videoDbgWarn("sw stop: vídeo não legível após commit (session.storage)", {
        tabId: tabForVideo,
        pendingKey: pk,
        hasEntry: Boolean(top),
        version: top?.v,
        fileNameInStore: typeof top?.fileName === "string" ? top.fileName : top?.fileName,
        byteLengthInStore: top?.byteLength,
        bytesTag,
        dataTag,
        hint: "Montagem OK mas leitura falhou — típico clone Uint8Array→Object; coerce-binary deve corrigir.",
      });
      const userHint =
        top && top.v === 3 && typeof top.fileName === "string"
          ? `O vídeo (${String(top.byteLength ?? "?")} B) está guardado mas este Chrome não devolveu os bytes ao ler (bytes=${bytesTag}). Atualize o Chrome ou tente de novo.`
          : "Não foi possível ler o vídeo em armazenamento temporário após a gravação. Tente de novo ou recarregue a extensão.";
      return { ok: false, code: "NO_ATTACHMENT", message: userHint };
    }
    const durationMs = Number(msg.durationMs ?? 0);
    const sizeBytes = Number(msg.sizeBytes ?? 0);
    videoDbgInfo("recording stopped (SW)", { sessionId, durationMs, sizeBytes });
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
    clearVideoBytesAccumulator(sessionId);
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
  if (sid) clearVideoBytesAccumulator(sid);
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
  videoDbgInfo("recording aborted (SW)", { sessionId: sid ?? null });
}
