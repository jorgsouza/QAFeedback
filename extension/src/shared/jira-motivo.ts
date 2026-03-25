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

/**
 * Payload REST API v3 (`POST /rest/api/3/issue`) para o custom field quando o tipo no Jira é
 * **multi-select**, **checkboxes** ou **select múltiplo** — a API exige um array de opções.
 * @see https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post
 */
export function jiraMotivoCustomFieldApiValue(
  motivo: JiraMotivoAbertura,
): { value: string }[] {
  return [{ value: motivo }];
}
