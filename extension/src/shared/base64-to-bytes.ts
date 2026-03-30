/**
 * Decodificação base64 → bytes sem `atob` (anexos grandes: WebM, HAR).
 */

export function normalizeAttachmentBase64(raw: string): string {
  let s = (raw ?? "").trim();
  const dataIdx = s.indexOf("base64,");
  if (s.startsWith("data:") && dataIdx >= 0) s = s.slice(dataIdx + 7);
  s = s.replace(/\s/g, "");
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s = s.replace(/[^A-Za-z0-9+/=]/g, "");
  const pad = s.length % 4;
  if (pad === 2) s += "==";
  else if (pad === 3) s += "=";
  else if (pad === 1) s = s.slice(0, -1);
  return s;
}

function decodeBase64CharCode(code: number): number {
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97 + 26;
  if (code >= 48 && code <= 57) return code - 48 + 52;
  if (code === 43) return 62;
  if (code === 47) return 63;
  throw new Error("invalid base64 character");
}

/** Decodifica base64 (RFC 4648) para `Uint8Array`. */
export function base64ToUint8Array(b64: string): Uint8Array {
  const n = normalizeAttachmentBase64(b64);
  if (n.length === 0) return new Uint8Array(0);
  if (n.length % 4 !== 0) {
    throw new Error("invalid base64 length");
  }

  const eq = n.length;
  let padding = 0;
  if (n.charCodeAt(eq - 1) === 61) padding++;
  if (eq >= 2 && n.charCodeAt(eq - 2) === 61) padding++;

  const outLen = (n.length / 4) * 3 - padding;
  const out = new Uint8Array(outLen);
  let op = 0;

  for (let i = 0; i < n.length; i += 4) {
    const a = decodeBase64CharCode(n.charCodeAt(i));
    const b = decodeBase64CharCode(n.charCodeAt(i + 1));
    const c2 = n.charCodeAt(i + 2);
    const d2 = n.charCodeAt(i + 3);
    const c = c2 === 61 ? 0 : decodeBase64CharCode(c2);
    const d = d2 === 61 ? 0 : decodeBase64CharCode(d2);

    const bitmap = (a << 18) | (b << 12) | (c << 6) | d;
    out[op++] = bitmap >> 16;
    if (c2 !== 61) out[op++] = (bitmap >> 8) & 255;
    if (d2 !== 61) out[op++] = bitmap & 255;
  }

  return out;
}
