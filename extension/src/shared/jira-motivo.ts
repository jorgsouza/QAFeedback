/**
 * Valores alinhados ao campo Jira "Motivo da abertura do Bug/Sub-Bug" (projeto REC).
 * O texto tem de coincidir com as opções configuradas no Jira para o custom field.
 */
export const JIRA_MOTIVO_ABERTURA_OPTIONS = [
  "Desenvolvimento",
  "Design",
  "Requisito",
  "Integração",
  "Segurança",
  "Em análise",
  "Auto resolvido/Orientação",
] as const;

export type JiraMotivoAbertura = (typeof JIRA_MOTIVO_ABERTURA_OPTIONS)[number];

export function isJiraMotivoAbertura(s: string): s is JiraMotivoAbertura {
  return (JIRA_MOTIVO_ABERTURA_OPTIONS as readonly string[]).includes(s);
}
