/** Limite alinhado ao PRD (~120–200). */
export const MAX_ISSUE_TITLE_LENGTH = 180;

/**
 * Primeiras 6 palavras (tokens separados por whitespace), depois trunca ao máximo.
 * `não,isto` conta como uma palavra (sem espaço interno).
 */
export function buildFallbackIssueTitle(whatHappened: string): string {
  const t = whatHappened.trim();
  if (!t) return "";
  const words = t.split(/\s+/).filter(Boolean).slice(0, 6);
  const joined = words.join(" ");
  return truncateIssueTitle(joined);
}

export function truncateIssueTitle(title: string): string {
  const s = title.trim();
  if (s.length <= MAX_ISSUE_TITLE_LENGTH) return s;
  if (MAX_ISSUE_TITLE_LENGTH <= 1) return "…";
  return `${s.slice(0, MAX_ISSUE_TITLE_LENGTH - 1)}…`;
}
