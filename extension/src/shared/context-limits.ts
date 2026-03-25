/**
 * Limites de retenção do contexto capturado para issues.
 * Ver `plans/prd-features-context-capture.md` (Phase 0). Alterar apenas aqui e alinhar `page-bridge`.
 */
export const CAPTURE_LIMITS = {
  /** Entradas de console incluídas no `CapturedIssueContextV1` enviado à issue */
  issueConsoleEntries: 8,
  /** Pedidos com falha incluídos no contexto da issue */
  issueFailedRequests: 5,

  /** Buffer no MAIN world antes do slice enviado ao content script (console) */
  bridgeConsoleBuffer: 20,
  /** Buffer no MAIN world para pedidos falhados */
  bridgeFailedRequestsBuffer: 20,
} as const;
