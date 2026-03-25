/**
 * Allowlist injetada em build: `extension/vite.config.ts` lê `BOARD_ID` e `VITE_JIRA_BOARD_ALLOWLIST`
 * do `.env` (pasta `extension/` ou raiz do repositório). Para mudar os IDs: edite o `.env` e rode
 * `npm run build` na pasta `extension/`.
 *
 * Parseia lista de IDs de quadro (ex.: `455, 451` ou `455;451`).
 * Ignora tokens não numéricos e duplicados; mantém ordem de primeira ocorrência.
 */
export function parseJiraBoardAllowlist(raw: string): number[] {
  const s = raw.trim();
  if (!s) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const part of s.split(/[,;\s]+/)) {
    const t = part.trim();
    if (!t) continue;
    const n = Number.parseInt(t, 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function builtInJiraBoardAllowlistIds(): number[] {
  try {
    const raw =
      typeof __QAF_JIRA_BOARD_ALLOWLIST__ !== "undefined" ? __QAF_JIRA_BOARD_ALLOWLIST__ : "";
    return parseJiraBoardAllowlist(raw);
  } catch {
    return [];
  }
}

/** Se `allowIds` estiver vazio, devolve todos os quadros (sem filtro de build). */
export function filterJiraBoardsByAllowlist<T extends { id: number }>(
  boards: T[],
  allowIds: number[],
): T[] {
  if (!allowIds.length) return boards;
  const set = new Set(allowIds);
  return boards.filter((b) => set.has(b.id));
}
