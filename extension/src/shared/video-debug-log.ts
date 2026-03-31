/** Logs de diagnóstico PRD-012 — filtrar no DevTools: `[QA Feedback][video]`. */

export const VIDEO_DEBUG_PREFIX = "[QA Feedback][video]" as const;

export function videoSessionShort(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Primeiros `n` bytes em hex (sem vazar ficheiro inteiro). */
export function videoHexHead(u8: Uint8Array, n = 12, cap = 32): string {
  const m = Math.min(Math.max(0, n), u8.byteLength, cap);
  if (m === 0) return "";
  return Array.from(u8.subarray(0, m), (b) => b.toString(16).padStart(2, "0")).join(" ");
}

export function videoDbgInfo(message: string, data?: Record<string, unknown>): void {
  if (data !== undefined) console.info(`${VIDEO_DEBUG_PREFIX} ${message}`, data);
  else console.info(`${VIDEO_DEBUG_PREFIX} ${message}`);
}

export function videoDbgWarn(message: string, data?: Record<string, unknown>): void {
  if (data !== undefined) console.warn(`${VIDEO_DEBUG_PREFIX} ${message}`, data);
  else console.warn(`${VIDEO_DEBUG_PREFIX} ${message}`);
}
