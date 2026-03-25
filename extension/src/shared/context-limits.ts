/**
 * Limites de retenção do contexto capturado para issues.
 * Ver `plans/prd-features-context-capture.md` (Phases 0–1). Alterar apenas aqui e alinhar `page-bridge`.
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

  /** Buffer no MAIN world antes do slice enviado ao content script (console) */
  bridgeConsoleBuffer: 20,
  /** Buffer no MAIN world para pedidos falhados */
  bridgeFailedRequestsBuffer: 20,

  /** Ignorar novo evento se for igual ao último dentro deste intervalo (ms) */
  timelineDedupeMs: 400,
  /** Mínimo entre eventos `input` no mesmo campo (reduz ruído por tecla) */
  timelineInputThrottleMs: 2000,
} as const;
