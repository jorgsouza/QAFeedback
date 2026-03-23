export type IssueFormState = {
  title: string;
  whatHappened: string;
  includeTechnicalContext: boolean;
  /** Se true, cria issue no GitHub (requer repo + token). */
  sendToGitHub: boolean;
  /** Se true, cria issue no Jira (requer motivo + config nas opções). */
  sendToJira: boolean;
  /** Um dos valores de `JIRA_MOTIVO_ABERTURA_OPTIONS` quando sendToJira. */
  jiraMotivoAbertura: string;
};

export type ConsoleEntry = {
  level: "error" | "warn" | "log";
  message: string;
};

export type FailedRequestEntry = {
  method: string;
  url: string;
  status: number;
  message: string;
};

export type ElementContext = {
  tag: string;
  id: string;
  classes: string;
  safeAttributes: string;
};

export type TechnicalContextPayload = {
  page: {
    url: string;
    title: string;
    userAgent: string;
    timestamp: string;
    viewport: string;
  };
  element?: ElementContext;
  console: ConsoleEntry[];
  failedRequests: FailedRequestEntry[];
};

export type RepoTarget = {
  owner: string;
  repo: string;
  /** Nome exibido no seletor do modal */
  label?: string;
};

export type ExtensionSettings = {
  githubToken: string;
  /** Legado: primeiro repo quando repos[] vazio */
  owner: string;
  repo: string;
  /** Vários destinos para o QA escolher no modal */
  repos?: RepoTarget[];
  /** Hostnames without protocol, e.g. "app.staging.example.com" */
  allowedHosts: string[];
  /** ex. https://reclameaqui.atlassian.net */
  jiraSiteUrl?: string;
  /** Email da conta Atlassian (API token) */
  jiraEmail?: string;
  jiraApiToken?: string;
  /** ex. REC */
  jiraProjectKey?: string;
  /** Nome do tipo de issue, ex. Bug */
  jiraIssueTypeName?: string;
  /**
   * ID do campo "Motivo da abertura do Bug/Sub-Bug" (ex. customfield_10042).
   * Se vazio, o motivo é incluído no início da descrição em Markdown.
   */
  jiraMotivoCustomFieldId?: string;
};

export type CreateIssuePayload = IssueFormState & {
  technicalContext?: TechnicalContextPayload;
};
