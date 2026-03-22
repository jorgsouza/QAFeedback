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
