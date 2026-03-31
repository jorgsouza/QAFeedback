/**
 * Normaliza valores binários após clone estruturado imperfeito (runtime.sendMessage, storage.session).
 */

export function coerceToUint8Array(raw: unknown): Uint8Array | null {
  if (raw == null) return null;
  try {
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    if (raw instanceof Uint8Array) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    if (ArrayBuffer.isView(raw)) {
      const v = raw as ArrayBufferView;
      return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    }
    const tag = Object.prototype.toString.call(raw);
    if (tag === "[object ArrayBuffer]") return new Uint8Array(raw as ArrayBuffer);
    if (tag === "[object Uint8Array]") {
      const u = raw as Uint8Array;
      return new Uint8Array(u.buffer, u.byteOffset, u.byteLength);
    }
    if (typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      if (o.buffer instanceof ArrayBuffer && typeof o.byteLength === "number") {
        const len = o.byteLength;
        const off = typeof o.byteOffset === "number" ? o.byteOffset : 0;
        if (len > 0 && off >= 0 && off + len <= o.buffer.byteLength) {
          return new Uint8Array(o.buffer, off, len);
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}
