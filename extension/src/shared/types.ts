export type IssueFormState = {
  title: string;
  whatHappened: string;
  includeTechnicalContext: boolean;
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
  /** URL base do serviço de IA (ex. https://ia-feedback.empresa.com ou http://127.0.0.1:8787) */
  iaServiceBaseUrl?: string;
  /** Segredo enviado como Bearer ao serviço de IA (não é o PAT do GitHub) */
  iaServiceApiKey?: string;
};

export type CreateIssuePayload = IssueFormState & {
  technicalContext?: TechnicalContextPayload;
  /**
   * Corpo completo da issue (Markdown) quando a IA refinou o texto.
   * Se ausente, usa-se `buildIssueBody` com o formulário + contexto técnico.
   */
  bodyMarkdown?: string;
};
