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
};

export type CreateIssuePayload = IssueFormState & {
  technicalContext?: TechnicalContextPayload;
};
