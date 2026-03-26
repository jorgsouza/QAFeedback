/**
 * Padrões de URL declarados em manifest.host_permissions (exceto API).
 * O Chrome costuma não marcar esses como "concedidos" em permissions.contains(),
 * mas o registerContentScripts precisa deles nas matches — tratamos como sempre ok.
 */
export const BUILTIN_MATCH_PATTERNS = new Set<string>([
  "http://localhost/*",
  "https://localhost/*",
  "http://127.0.0.1/*",
  "https://127.0.0.1/*",
]);

export function normalizeHost(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

/**
 * Padrões para injetar / solicitar permissão em um host permitido pelo usuário.
 * Inclui `*.domínio` (exceto localhost / IP) para cobrir www e outros subdomínios.
 */
export function matchPatternsForAllowedHost(host: string): string[] {
  const h = normalizeHost(host);
  if (!h) return [];
  const patterns = [`https://${h}/*`, `http://${h}/*`];
  if (h !== "localhost" && h !== "127.0.0.1" && h.includes(".")) {
    patterns.push(`https://*.${h}/*`, `http://*.${h}/*`);
  }
  return patterns;
}

/**
 * Mesma noção de host permitido que `matchPatternsForAllowedHost`: exato ou subdomínio
 * (sem wildcard para localhost / 127.0.0.1).
 */
export function hostnameAllowedByList(hostname: string, allowedHosts: string[]): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h) return false;
  for (const raw of allowedHosts) {
    const base = normalizeHost(raw).toLowerCase();
    if (!base) continue;
    if (h === base) return true;
    if (base === "localhost" || base === "127.0.0.1") continue;
    if (base.includes(".") && h.endsWith(`.${base}`)) return true;
  }
  return false;
}

/** Só `http:`/`https:`; URLs inválidas ou não HTTP(S) → false. */
export function urlMatchesAllowedHosts(pageUrl: string, allowedHosts: string[]): boolean {
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return hostnameAllowedByList(u.hostname, allowedHosts);
  } catch {
    return false;
  }
}
