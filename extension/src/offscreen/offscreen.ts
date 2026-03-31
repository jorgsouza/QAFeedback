import { uint8ArrayToBase64Latin1 } from "../shared/base64-to-bytes";
import {
  videoDbgInfo,
  videoDbgWarn,
  videoHexHead,
  videoSessionShort,
} from "../shared/video-debug-log";
import { pickWebmMimeTypeForMediaRecorder } from "../shared/video-recording-mime";

const JIRA_MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/** Tamanho máx. por mensagem `runtime.sendMessage` (clone estruturado de `ArrayBuffer`). */
const VIDEO_BYTES_CHUNK_SIZE = 512 * 1024;

type StartMsg = {
  type: "QAF_OFFSCREEN_VIDEO_START";
  streamId: string;
  sessionId: string;
  videoBitsPerSecond?: number;
};

type StopMsg = { type: "QAF_OFFSCREEN_VIDEO_STOP"; sessionId: string; tabId: number };
type AbortMsg = { type: "QAF_OFFSCREEN_VIDEO_ABORT"; sessionId?: string };

function sendSignal(payload: Record<string, unknown>): void {
  void chrome.runtime.sendMessage(payload).catch(() => {});
}

let activeSessionId: string | null = null;
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let chosenMime = "";
/** Partes WebM de `ondataavailable` (ordem preservada; não descartar o início — lá está o EBML). */
let recordedChunks: Blob[] = [];
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
  recordedChunks = [];
  chosenMime = "";
  activeSessionId = null;
}

async function handleStart(msg: StartMsg): Promise<void> {
  const { streamId, sessionId, videoBitsPerSecond } = msg;
  if (activeSessionId) {
    await handleAbort({ type: "QAF_OFFSCREEN_VIDEO_ABORT", sessionId: activeSessionId });
  }
  activeSessionId = sessionId;
  recordedChunks = [];
  recordStartMs = Date.now();
  try {
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
      if (ev.data.size > 0) recordedChunks.push(ev.data);
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
    videoDbgInfo("offscreen → gravador iniciado", {
      sessionId: videoSessionShort(sessionId),
      mimeType: chosenMime,
      videoBitsPerSecond: bps,
    });
  } catch (e) {
    cleanupTracks();
    videoDbgWarn("offscreen → start falhou", {
      sessionId: videoSessionShort(sessionId),
      error: e instanceof Error ? e.message : String(e),
    });
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
  const { sessionId, tabId } = msg;
  if (typeof tabId !== "number" || !Number.isFinite(tabId)) {
    sendSignal({
      type: "QAF_OFFSCREEN_VIDEO_SIGNAL",
      phase: "error",
      sessionId,
      code: "NO_TAB",
      message: "Separador inválido ao finalizar vídeo.",
    });
    return;
  }
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
  const blobPartCount = recordedChunks.length;
  const blob = new Blob(recordedChunks, { type: mime || "video/webm" });
  recordedChunks = [];
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
    videoDbgInfo("offscreen → blob final", {
      sessionId: videoSessionShort(sessionId),
      tabId,
      blobParts: blobPartCount,
      blobSize: blob.size,
      recorderMime: mime || "video/webm",
    });
    const full = new Uint8Array(await blob.arrayBuffer());
    const fileName = `qa-recording-${Date.now()}.webm`;
    const mimeType = "video/webm";
    const byteLength = full.byteLength;
    const total = Math.max(1, Math.ceil(byteLength / VIDEO_BYTES_CHUNK_SIZE));
    videoDbgInfo("offscreen → a enviar para SW", {
      sessionId: videoSessionShort(sessionId),
      tabId,
      byteLength,
      chunkCount: total,
      chunkSizeMax: VIDEO_BYTES_CHUNK_SIZE,
      headHex: videoHexHead(full, 8),
    });
    for (let i = 0; i < total; i++) {
      const start = i * VIDEO_BYTES_CHUNK_SIZE;
      const end = Math.min(start + VIDEO_BYTES_CHUNK_SIZE, byteLength);
      const slice = full.subarray(start, end);
      /** Base64 por fatia: em vários ambientes `ArrayBuffer` em `sendMessage` chega ao SW como `{}`. */
      const base64 = uint8ArrayToBase64Latin1(slice);
      const ack = (await chrome.runtime.sendMessage({
        type: "QAF_OFFSCREEN_VIDEO_BYTES_CHUNK",
        sessionId,
        tabId,
        index: i,
        total,
        base64,
      })) as { ok?: boolean } | undefined;
      videoDbgInfo("offscreen → chunk enviado (sendMessage)", {
        sessionId: videoSessionShort(sessionId),
        chunk: `${i + 1}/${total}`,
        rawBytes: slice.byteLength,
        base64Chars: base64.length,
      });
      if (ack && typeof ack === "object" && ack.ok === false) {
        throw new Error("Falha ao enviar bloco do vídeo.");
      }
    }
    const done = (await chrome.runtime.sendMessage({
      type: "QAF_OFFSCREEN_VIDEO_BYTES_COMMIT",
      sessionId,
      tabId,
      durationMs,
      sizeBytes,
      fileName,
      mimeType,
      byteLength,
    })) as { ok?: boolean; message?: string } | undefined;
    if (!done || typeof done !== "object" || done.ok !== true) {
      videoDbgWarn("offscreen → commit SW respondeu erro", {
        sessionId: videoSessionShort(sessionId),
        done,
      });
      throw new Error(
        typeof done?.message === "string" && done.message.trim()
          ? done.message
          : "Falha ao gravar vídeo no armazenamento da extensão.",
      );
    }
    videoDbgInfo("offscreen → transferência + commit OK", {
      sessionId: videoSessionShort(sessionId),
      tabId,
      byteLength,
    });
  } catch (e) {
    videoDbgWarn("offscreen → exceção após stop", {
      sessionId: videoSessionShort(sessionId),
      error: e instanceof Error ? e.message : String(e),
    });
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
  videoDbgInfo("offscreen → abort pedido", { sessionId: videoSessionShort(sid) });
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
