/**
 * Gera o título a partir das primeiras palavras de um texto (ex.: descrição).
 * Útil quando integrar IA; o utilizador continua a poder editar/ditar o título no campo.
 */
export function titleFromDescription(description: string, wordCount = 4): string {
  const parts = description
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (parts.length === 0) return "";
  return parts.slice(0, wordCount).join(" ");
}
