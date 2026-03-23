import { timingSafeEqual } from "node:crypto";

function buf(s: string): Buffer {
  return Buffer.from(s, "utf8");
}

/** Comparação em tempo constante para tokens. */
export function safeEqualString(a: string, b: string): boolean {
  const ba = buf(a);
  const bb = buf(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Extrai Bearer do header Authorization ou X-Api-Key.
 * Devolve null se ausente.
 */
export function extractClientApiKey(headers: Record<string, string | string[] | undefined>): string | null {
  const auth = headers.authorization ?? headers.Authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const x = headers["x-api-key"] ?? headers["X-Api-Key"];
  if (typeof x === "string" && x.trim()) return x.trim();
  return null;
}
