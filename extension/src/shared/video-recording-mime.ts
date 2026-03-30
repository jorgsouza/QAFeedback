/** Ordem PRD-012 / plano: VP9+Opus → VP8+Opus → WebM genérico. */
const WEBM_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const;

export function pickWebmMimeTypeForMediaRecorder(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return "";
  }
  for (const c of WEBM_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}
