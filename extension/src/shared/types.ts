/** PRD-011 Fase 2 — como o texto técnico da issue é “fechado” para exposição. */
export type CaptureModeV1 = "debug-interno" | "producao-sensivel";

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

/** Phase 1 — linha do tempo de interação (MAIN world → issue). */
export type InteractionTimelineKindV1 =
  | "click"
  | "submit"
  | "input"
  | "change"
  | "keydown"
  | "navigate"
  /** PRD-011 Fase 5 — scroll vertical significativo (limiares no bridge). */
  | "scroll"
  /** PRD-011 Fase 5 — mudança em diálogo/modal visível. */
  | "dialog"
  /** PRD-011 Fase 5 — troca de aba/secção (role=tab selecionado). */
  | "section";

export type InteractionTimelineEntryV1 = {
  at: string;
  kind: InteractionTimelineKindV1;
  summary: string;
};

/** Phase 2 — resumo de pedido HTTP (fetch/XHR) para a issue. */
export type NetworkRequestSummaryEntryV1 = {
  at: string;
  method: string;
  /** URL sanitizada (sem query/hash). */
  url: string;
  status: number;
  durationMs: number;
  aborted?: boolean;
  statusText?: string;
  requestId?: string;
  correlationId?: string;
  responseContentType?: string;
  /**
   * PRD-011 Fase 4 — ms entre o instante deste pedido e a última âncora da timeline (clique/submit/navegação),
   * só quando o pedido ocorre **depois** da âncora e dentro da janela configurada.
   */
  deltaToLastActionMs?: number;
  /** Tipo da última âncora usada para `deltaToLastActionMs` / `isCorrelated`. */
  correlationTriggerKind?: InteractionTimelineKindV1;
  /** True quando o pedido cai na janela temporal após a âncora (correlação, não causalidade). */
  isCorrelated?: boolean;
};

export type ElementContext = {
  tag: string;
  id: string;
  classes: string;
  safeAttributes: string;
};

export type VisualDialogSnapshotV1 = {
  /** Ex.: role=dialog, aria-modal=true, alertdialog */
  type: string;
  /** aria-label / aria-labelledby ou fallback de texto */
  title?: string;
};

export type VisualStateSnapshotV1 = {
  /** Até N diálogos/modalidades visíveis no momento do envio. */
  dialogs?: VisualDialogSnapshotV1[];
  /** Indica presença de sinalização de loading/busy no DOM. */
  busyIndicators?: string[];
  /** Abas ativas (role=tab com aria-selected=true) */
  activeTabs?: string[];
};

export type TargetDomHintV1 = {
  /** Ex.: `button[data-testid="..."]` ou `#id` */
  selectorHint?: string;
  role?: string;
  ariaLabel?: string;
  textHint?: string;
  /** Tamanho aproximado do alvo no momento do clique/abertura. */
  rect?: { w: number; h: number };
};

export type RuntimeErrorSnapshotV1 = {
  at: string;
  kind: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  /** Quando disponível (error event) */
  file?: string;
  line?: number;
  col?: number;
  /** Contagem agregada (dedupe por mensagem+stack no bridge). */
  count?: number;
  /**
   * Correlação simples com a última ação da timeline (ms entre “erro” e “último click”).
   * Cálculo feito no content script (quando existe click).
   */
  deltaToLastClickMs?: number;
  /**
   * PRD-011 Fase 4 — ms após a última âncora (clique/submit/navegação) quando o erro ocorre depois dela.
   */
  deltaToLastActionMs?: number;
};

/** PRD-011 Fase 3 — par chave/valor (ex.: feature flag) para a issue; valores sempre truncados na captura. */
export type AppEnvironmentKeyValueV1 = {
  key: string;
  value: string;
};

/**
 * PRD-011 Fase 3 — metadados best-effort da aplicação (build, tenant, flags quando expostos).
 * Campos opcionais; omitir o objeto inteiro quando não houver sinais.
 */
export type AppEnvironmentSnapshotV1 = {
  appName?: string;
  environmentName?: string;
  buildId?: string;
  release?: string;
  commitSha?: string;
  tenant?: string;
  role?: string;
  featureFlags?: AppEnvironmentKeyValueV1[];
  experiments?: AppEnvironmentKeyValueV1[];
};

export type PerformanceSignalsSnapshotV1 = {
  /** Largest Contentful Paint (best-effort). */
  lcpMs?: number;
  lcpAt?: string;
  /** Interaction to Next Paint (best-effort). */
  inpMs?: number;
  inpAt?: string;
  /** Cumulative Layout Shift (CLS, best-effort). */
  cls?: number;
  /** Long tasks (best-effort). */
  longTasks?: {
    count?: number;
    longestMs?: number;
    lastAt?: string;
  };
};

/**
 * Dados técnicos da página sem metadados de versão do contrato.
 * Preferir `CapturedIssueContextV1` no payload de criação de issues.
 */
export type TechnicalContextPayload = {
  page: {
    url: string;
    /** `location.pathname` normalizado (SPA incluído). */
    pathname: string;
    /** `location.search` (query string). */
    routeSearch: string;
    /** Slug técnico para UI e filtros (ex.: ra-notifications). */
    routeSlug: string;
    /** Rótulo para humanos (ex.: Home, ou pathname se desconhecido). */
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
  /**
   * Phase 4 — heurísticas visuais e hints do DOM do alvo.
   * Campos opcionais para manter compatibilidade com payloads capturados em versões anteriores.
   */
  visualState?: VisualStateSnapshotV1;
  targetDomHint?: TargetDomHintV1;
  /**
   * Phase 5 — runtime errors e sinais de performance observados nesta sessão.
   * Fields opcionais para não penalizar browsers sem APIs.
   */
  runtimeErrors?: RuntimeErrorSnapshotV1[];
  performanceSignals?: PerformanceSignalsSnapshotV1;
  /** Phase 1 — últimos eventos significativos (clique, navegação SPA, etc.) */
  interactionTimeline?: InteractionTimelineEntryV1[];
  /** Phase 2 — prioridade erros/lentos; ver `pickNetworkSummariesForIssue` */
  networkRequestSummaries?: NetworkRequestSummaryEntryV1[];
  console: ConsoleEntry[];
  failedRequests: FailedRequestEntry[];
  /**
   * PRD-011 — achados heurísticos (segurança/PII) sobre dados já capturados.
   * Nunca incluir valores completos de segredos; usar `samplePreview` truncado.
   */
  sensitiveFindings?: SensitiveFindingV1[];
  /** PRD-011 Fase 3 — ambiente da app quando a página expõe sinais (meta, globais, storage allowlist). */
  appEnvironment?: AppEnvironmentSnapshotV1;
  /** Modo aplicado na montagem do contexto (auditoria + builder). */
  captureMode?: CaptureModeV1;
};

/** PRD-011 — tipo estável de achado sensível (heurística, não confirmação). */
export type SensitiveFindingKindV1 =
  | "secret_or_token"
  | "session_cookie"
  | "pii"
  | "injection_hint"
  | "mixed_content"
  | "misconfiguration";

export type SensitiveFindingSourceV1 = "network" | "console" | "runtime" | "dom" | "page";

export type SensitiveFindingSeverityV1 = "info" | "low" | "medium" | "high";

export type SensitiveFindingV1 = {
  kind: SensitiveFindingKindV1;
  severity: SensitiveFindingSeverityV1;
  source: SensitiveFindingSourceV1;
  /** Onde olhar (ex.: linha de rede, snippet de “fonte”). */
  location: string;
  /** Uma frase neutra (“Possível …”). */
  summary: string;
  /** Dedupe / referência sem expor o valor bruto. */
  evidenceFingerprint: string;
  /** Sempre truncado / mascarado. */
  samplePreview: string;
  confidence?: "low" | "medium";
  actionSuggested?: string;
};

/**
 * Contrato versionado do contexto capturado (Phase 0+). Fases futuras podem acrescentar
 * campos opcionais mantendo `version` para migração.
 */
export type CapturedIssueContextV1 = TechnicalContextPayload & {
  readonly version: 1;
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
  /**
   * PRD-011 — debug interno (padrão) mantém mais texto na issue; produção sensível reduz brutos.
   */
  captureMode?: CaptureModeV1;
};

/** Imagem serializada para o service worker anexar após criar a issue no Jira. */
export type JiraImageAttachmentPayload = {
  fileName: string;
  mimeType: string;
  /** Base64 sem prefixo data: */
  base64: string;
};

export type CreateIssuePayload = IssueFormState & {
  capturedContext?: CapturedIssueContextV1;
  /** Só usado quando `sendToJira`; anexos via REST após POST /issue. */
  jiraImageAttachments?: JiraImageAttachmentPayload[];
  /**
   * Quadro escolhido no modal de feedback (tem prioridade sobre `jiraSoftwareBoardId` nas opções).
   * Deve ir dentro do payload para o Chrome entregar de forma fiável ao service worker.
   */
  jiraSoftwareBoardId?: string;
};
