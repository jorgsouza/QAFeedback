import { loadSettings } from "../shared/storage";

const OFFSCREEN_HTML = "offscreen.html";

type ExpectedPhase = "started" | "stopped";

type SignalWaiter = {
  expected: ExpectedPhase;
  resolve: (msg: Record<string, unknown>) => void;
  reject: (e: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const signalWaiters = new Map<string, SignalWaiter>();

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
  | { ok: true; sessionId: string; startedAt: string; maxDurationSec: number }
  | { ok: false; code: string; message: string };

export type VideoStopResult =
  | {
      ok: true;
      attachment: { fileName: string; mimeType: string; base64: string };
      durationMs: number;
      sizeBytes: number;
    }
  | { ok: false; code: string; message: string };

let currentSessionId: string | null = null;

export function getActiveVideoSessionId(): string | null {
  return currentSessionId;
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
  if (currentSessionId) {
    return {
      ok: false,
      code: "ALREADY_RECORDING",
      message: "Já existe uma gravação ativa. Pare ou cancele antes de iniciar outra.",
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
  console.info("[QA Feedback] video recording started", { sessionId, tabId, maxDurationSec });
  return {
    ok: true,
    sessionId,
    startedAt: new Date().toISOString(),
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
  const stoppedPromise = registerSignalWait(sessionId, "stopped", 120_000);
  try {
    await chrome.runtime.sendMessage({ type: "QAF_OFFSCREEN_VIDEO_STOP", sessionId });
  } catch (e) {
    signalWaiters.delete(sessionId);
    currentSessionId = null;
    return {
      ok: false,
      code: "SEND_FAILED",
      message: e instanceof Error ? e.message : "Falha ao parar gravação.",
    };
  }
  try {
    const msg = await stoppedPromise;
    currentSessionId = null;
    const att = msg.attachment as { fileName?: string; mimeType?: string; base64?: string } | undefined;
    if (!att?.fileName || !att?.base64) {
      return { ok: false, code: "NO_ATTACHMENT", message: "Resposta de gravação incompleta." };
    }
    const durationMs = Number(msg.durationMs ?? 0);
    const sizeBytes = Number(msg.sizeBytes ?? 0);
    console.info("[QA Feedback] video recording stopped", { sessionId, durationMs, sizeBytes });
    return {
      ok: true,
      attachment: {
        fileName: att.fileName,
        mimeType: att.mimeType || "video/webm",
        base64: att.base64,
      },
      durationMs,
      sizeBytes,
    };
  } catch (e) {
    currentSessionId = null;
    return {
      ok: false,
      code: "STOP_ERROR",
      message: e instanceof Error ? e.message : "Falha ao finalizar vídeo.",
    };
  }
}

export async function abortViewportRecording(sessionId?: string): Promise<void> {
  const sid = sessionId && sessionId === currentSessionId ? sessionId : currentSessionId;
  currentSessionId = null;
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
