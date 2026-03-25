/**
 * Gera o título da issue a partir das primeiras palavras da descrição
 * (digitada ou ditada). Palavras = segmentos separados por espaço em branco.
 */
export function titleFromDescription(description: string, wordCount = 4): string {
  const parts = description
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (parts.length === 0) return "";
  return parts.slice(0, wordCount).join(" ");
}
