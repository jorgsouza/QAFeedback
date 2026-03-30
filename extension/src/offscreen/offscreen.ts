import { pickWebmMimeTypeForMediaRecorder } from "../shared/video-recording-mime";

const JIRA_MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

type StartMsg = {
  type: "QAF_OFFSCREEN_VIDEO_START";
  streamId: string;
  sessionId: string;
  maxWindowSec?: number;
  videoBitsPerSecond?: number;
};

type StopMsg = { type: "QAF_OFFSCREEN_VIDEO_STOP"; sessionId: string };
type AbortMsg = { type: "QAF_OFFSCREEN_VIDEO_ABORT"; sessionId?: string };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("read"));
    r.readAsDataURL(blob);
  });
}

function sendSignal(payload: Record<string, unknown>): void {
  void chrome.runtime.sendMessage(payload).catch(() => {});
}

let activeSessionId: string | null = null;
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let chosenMime = "";
let circularChunks: Blob[] = [];
let recordStartMs = 0;

function cleanupTracks(): void {
  if (mediaStream) {
    for (const t of mediaStream.getTracks()) {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    }
  }
  mediaStream = null;
  mediaRecorder = null;
  circularChunks = [];
  chosenMime = "";
  activeSessionId = null;
}

async function handleStart(msg: StartMsg): Promise<void> {
  const { streamId, sessionId, maxWindowSec, videoBitsPerSecond } = msg;
  if (activeSessionId) {
    await handleAbort({ type: "QAF_OFFSCREEN_VIDEO_ABORT", sessionId: activeSessionId });
  }
  activeSessionId = sessionId;
  circularChunks = [];
  recordStartMs = Date.now();
  try {
    const win = Math.max(30, Math.min(120, maxWindowSec ?? 90));
    const tabConstraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
    } as MediaStreamConstraints;

    mediaStream = await navigator.mediaDevices.getUserMedia(tabConstraints);
    if (activeSessionId !== sessionId) {
      for (const t of mediaStream.getTracks()) t.stop();
      mediaStream = null;
      return;
    }
    chosenMime = pickWebmMimeTypeForMediaRecorder();
    if (!chosenMime) {
      cleanupTracks();
      sendSignal({
        type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
        phase: "error",
        sessionId,
        code: "NO_CODEC",
        message: "Nenhum formato WebM suportado neste Chrome.",
      });
      return;
    }
    const bps = videoBitsPerSecond ?? 800_000;
    mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: chosenMime,
      videoBitsPerSecond: bps,
    });
    mediaRecorder.ondataavailable = (ev: BlobEvent) => {
      if (ev.data.size > 0) {
        circularChunks.push(ev.data);
        while (circularChunks.length > win) circularChunks.shift();
      }
    };
    mediaRecorder.start(1000);
    if (activeSessionId !== sessionId) {
      cleanupTracks();
      return;
    }
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "started",
      sessionId,
    });
  } catch (e) {
    cleanupTracks();
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "error",
      sessionId,
      code: "START_FAILED",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

async function handleStop(msg: StopMsg): Promise<void> {
  const { sessionId } = msg;
  if (!activeSessionId || sessionId !== activeSessionId) {
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "error",
      sessionId,
      code: "SESSION_MISMATCH",
      message: "Sessão de gravação inválida ou já terminada.",
    });
    return;
  }
  const rec = mediaRecorder;
  const stream = mediaStream;
  const mime = chosenMime;
  const started = recordStartMs;
  if (!rec || rec.state === "inactive") {
    cleanupTracks();
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "error",
      sessionId,
      code: "NOT_RECORDING",
      message: "Gravação já estava inativa.",
    });
    return;
  }
  const stopped = new Promise<void>((resolve) => {
    rec.addEventListener("stop", () => resolve(), { once: true });
  });
  try {
    rec.stop();
  } catch (e) {
    cleanupTracks();
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "error",
      sessionId,
      code: "STOP_FAILED",
      message: e instanceof Error ? e.message : String(e),
    });
    return;
  }
  await stopped;
  if (stream) {
    for (const t of stream.getTracks()) {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    }
  }
  mediaRecorder = null;
  mediaStream = null;
  activeSessionId = null;
  const blob = new Blob(circularChunks, { type: mime || "video/webm" });
  circularChunks = [];
  chosenMime = "";
  const durationMs = Math.max(0, Date.now() - started);
  const sizeBytes = blob.size;
  if (sizeBytes > JIRA_MAX_ATTACHMENT_BYTES) {
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "error",
      sessionId,
      code: "FILE_TOO_LARGE",
      message: `Vídeo maior que ${JIRA_MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB. Grave menos tempo ou reduza movimento na página.`,
    });
    return;
  }
  if (sizeBytes === 0) {
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "error",
      sessionId,
      code: "EMPTY_FILE",
      message: "Não foi gerado conteúdo de vídeo.",
    });
    return;
  }
  try {
    const base64 = await blobToBase64(blob);
    const fileName = `qa-recording-${Date.now()}.webm`;
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "stopped",
      sessionId,
      attachment: {
        fileName,
        mimeType: "video/webm",
        base64,
      },
      durationMs,
      sizeBytes,
    });
  } catch (e) {
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "error",
      sessionId,
      code: "ENCODE_FAILED",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

async function handleAbort(msg: AbortMsg): Promise<void> {
  const sid = msg.sessionId ?? activeSessionId;
  if (!sid) return;
  if (activeSessionId && sid !== activeSessionId) return;
  const rec = mediaRecorder;
  if (rec && rec.state !== "inactive") {
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }
  cleanupTracks();
}

chrome.runtime.onMessage.addListener((message: StartMsg | StopMsg | AbortMsg) => {
  if (message?.type === "QAF_OFFSCREEN_VIDEO_START") {
    void handleStart(message);
    return false;
  }
  if (message?.type === "QAF_OFFSCREEN_VIDEO_STOP") {
    void handleStop(message);
    return false;
  }
  if (message?.type === "QAF_OFFSCREEN_VIDEO_ABORT") {
    void handleAbort(message);
    return false;
  }
  return false;
});
