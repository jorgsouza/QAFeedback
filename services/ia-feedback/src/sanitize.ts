const DEFAULT_MAX_WHAT = 12_000;
const DEFAULT_MAX_CTX = 24_000;

/** Remove padrões óbvios de segredo antes de enviar ao modelo (MVP). */
export function stripSensitivePatterns(input: string): string {
  let s = input;
  s = s.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [redacted]");
  s = s.replace(/password\s*=\s*[^\s&]+/gi, "password=[redacted]");
  s = s.replace(/token\s*=\s*[^\s&]+/gi, "token=[redacted]");
  return s;
}

export function truncate(input: string, max: number): string {
  const t = input.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

export function sanitizeWhatHappened(raw: string, max = DEFAULT_MAX_WHAT): string {
  return truncate(stripSensitivePatterns(raw), max);
}

export function serializeTechnicalContext(ctx: unknown, max = DEFAULT_MAX_CTX): string {
  if (ctx == null) return "";
  let s: string;
  try {
    s = typeof ctx === "string" ? ctx : JSON.stringify(ctx);
  } catch {
    s = String(ctx);
  }
  return truncate(stripSensitivePatterns(s), max);
}
