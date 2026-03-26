/**
 * Limites de retenção do contexto capturado para issues.
 * Ver `prd/PRD-003-context-rich-issues/plan.md` (Phases 0–1). Alterar apenas aqui e alinhar `page-bridge`.
 */
export const CAPTURE_LIMITS = {
  /** Entradas de console incluídas no `CapturedIssueContextV1` enviado à issue */
  issueConsoleEntries: 8,
  /** Pedidos com falha incluídos no contexto da issue */
  issueFailedRequests: 5,
  /** Eventos na linha do tempo incluídos no contexto da issue (Phase 1) */
  issueTimelineEntries: 40,
  /** Buffer no MAIN world para a linha do tempo antes do slice */
  bridgeTimelineBuffer: 50,

  /**
   * Linha do tempo contínua (mesma aba, multi-URL) — teto no service worker antes do slice para a issue.
   */
  swTimelineSessionMaxEntries: 400,
  /** Sem atividade neste intervalo (ms) a sessão SW expira e descarta entradas. */
  swTimelineSessionTtlMs: 2 * 60 * 60 * 1000,

  /** Buffer no MAIN world antes do slice enviado ao content script (console) */
  bridgeConsoleBuffer: 20,
  /** Buffer no MAIN world para pedidos falhados */
  bridgeFailedRequestsBuffer: 20,

  /** Ignorar novo evento se for igual ao último dentro deste intervalo (ms) */
  timelineDedupeMs: 400,
  /** PRD-010 Fase 5 — mínimo de |ΔscrollY| (px) para registar scroll na timeline */
  timelineScrollMinDeltaPx: 120,
  /** PRD-010 Fase 5 — intervalo mínimo entre entradas de scroll na timeline */
  timelineScrollThrottleMs: 900,
  /** PRD-010 Fase 5 — debounce para agregar mutações DOM (modal/abas) */
  timelineDomMutationDebounceMs: 280,
  /** Mínimo entre eventos `input` no mesmo campo (reduz ruído por tecla) */
  timelineInputThrottleMs: 2000,

  /** Pedidos no buffer do bridge antes do slice para o content script */
  bridgeNetworkBuffer: 50,
  /** Máximo de linhas na secção “Requisições relevantes” na issue */
  issueNetworkSummaryMax: 20,
  /** Duração a partir da qual o pedido conta como “lento” no resumo */
  networkSlowThresholdMs: 3000,
  /**
   * PRD-010 Fase 4 — janela após última ação “forte” (clique/submit/navegação) para marcar pedidos
   * de rede como correlacionados (ordenação e narrative; não é prova causal).
   * Não limita o buffer geral de rede/timeline — só o intervalo em que um pedido “conta como” próximo da âncora.
   */
  correlationWindowAfterActionMs: 45_000,

  /** Eventos de runtime (error/unhandledrejection) incluídos na issue */
  issueRuntimeErrorEntries: 3,
  /** Buffer no MAIN world antes do slice enviado ao content script */
  bridgeRuntimeErrorBuffer: 20,

  /** Sinais de performance (best-effort) incluídos na issue */
  issuePerformance: 1,
  /** Como mínimo entre emissões de sinais de performance (ms) */
  performanceEmitMinMs: 500,
  /** Long tasks: quantos IDs/ocorrências manter (best-effort) */
  longTaskEntriesMax: 10,

  /** PRD-010 Fase 3 — campos string do snapshot de ambiente da app */
  appEnvFieldMax: 120,
  appEnvCommitMax: 40,
  /** Máximo de pares key/value em featureFlags / experiments */
  appEnvFlagsMax: 12,
  appEnvFlagKeyMax: 48,
  appEnvFlagValueMax: 64,
} as const;
