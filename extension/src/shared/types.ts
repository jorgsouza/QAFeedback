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
    /** `location.pathname` normalizado (SPA incluído). */
    pathname: string;
    /** `location.search` (query string). */
    routeSearch: string;
    /** Rótulo para humanos (ex.: Home, Página da empresa). */
    routeLabel: string;
    /** Chave estável para agrupar (ex.: home, empresa, other). */
    routeKey: string;
    title: string;
    userAgent: string;
    timestamp: string;
    viewport: string;
    /** `screen.width`×`screen.height` em CSS px (ecrã físico / OS). */
    screenCss: string;
    devicePixelRatio: string;
    maxTouchPoints: number;
    /** `matchMedia('(pointer: coarse)')` — indício de interação tátil. */
    pointerCoarse: boolean;
    /**
     * Indício automático desktop vs móvel / emulação DevTools.
     * Não existe API fiável para “toggle dispositivo” do DevTools na página.
     */
    viewModeHint: string;
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
  /**
   * ID numérico do quadro Jira Software (ex. 451). Preferência sobre extrair do URL.
   * O JQL do filtro do quadro é lido na API para preencher campos na criação da issue.
   */
  jiraSoftwareBoardId?: string;
  /**
   * Cache do último teste de ligação: campos inferidos do filtro do quadro (opcional).
   * Na criação, a extensão volta a consultar o Jira; isto só serve de fallback e resumo na UI.
   */
  jiraBoardAutoFields?: { fieldId: string; set: unknown }[];
  /** Avançado: força um select se a deteção automática falhar. */
  jiraBoardFilterSelectFieldId?: string;
  jiraBoardFilterSelectValue?: string;
  /**
   * Quando true, o modal de feedback tenta capturar tráfego HTTP (CDP) e anexar HAR ao Jira.
   * Requer permissão `debugger` e pode conflitar com DevTools aberto na mesma aba.
   */
  fullNetworkDiagnostic?: boolean;
};

/** Imagem serializada para o service worker anexar após criar a issue no Jira. */
export type JiraImageAttachmentPayload = {
  fileName: string;
  mimeType: string;
  /** Base64 sem prefixo data: */
  base64: string;
};

export type CreateIssuePayload = IssueFormState & {
  technicalContext?: TechnicalContextPayload;
  /** Só usado quando `sendToJira`; anexos via REST após POST /issue. */
  jiraImageAttachments?: JiraImageAttachmentPayload[];
  /**
   * Quadro escolhido no modal de feedback (tem prioridade sobre `jiraSoftwareBoardId` nas opções).
   * Deve ir dentro do payload para o Chrome entregar de forma fiável ao service worker.
   */
  jiraSoftwareBoardId?: string;
};
