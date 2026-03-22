const MAX_LEN = 500;

/** Remove query string and hash to avoid leaking tokens in URLs. */
export function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return raw.slice(0, MAX_LEN);
  }
}

export function truncate(text: string, max = MAX_LEN): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const SENSITIVE_ATTR = /^(password|token|authorization|cookie|set-cookie|secret|api-?key)$/i;

export function sanitizeElementAttributes(el: Element): string {
  if (!(el instanceof HTMLElement)) return "";
  const parts: string[] = [];
  for (const a of Array.from(el.attributes)) {
    if (SENSITIVE_ATTR.test(a.name)) continue;
    if (a.name.startsWith("on")) continue;
    parts.push(`${a.name}=${truncate(a.value, 120)}`);
  }
  return truncate(parts.join(", "), 400);
}
