import type { CapturedIssueContextV1, CaptureModeV1 } from "./types";
import { truncate } from "./sanitizer";

export function normalizeCaptureMode(value: unknown): CaptureModeV1 {
  return value === "producao-sensivel" ? "producao-sensivel" : "debug-interno";
}

/**
 * Em `producao-sensivel`, reduz dados brutos no payload da issue (não remove a secção de achados sensíveis).
 * A detecção de achados deve ter corrido antes, com o contexto “cheio”.
 */
export function applyCaptureModeToContext(
  ctx: CapturedIssueContextV1,
  mode: CaptureModeV1,
): CapturedIssueContextV1 {
  const tagged: CapturedIssueContextV1 = { ...ctx, captureMode: mode };
  if (mode === "debug-interno") return tagged;

  return {
    ...tagged,
    page: {
      ...tagged.page,
      title: truncate(tagged.page.title, 120),
      userAgent: truncate(tagged.page.userAgent, 200),
      routeSearch:
        tagged.page.routeSearch.length > 80
          ? truncate(tagged.page.routeSearch, 80)
          : tagged.page.routeSearch,
    },
    console: tagged.console.map((c) => ({
      level: c.level,
      message: truncate(c.message, 180),
    })),
    interactionTimeline: tagged.interactionTimeline?.map((t) => ({
      ...t,
      summary: truncate(t.summary, 100),
    })),
    runtimeErrors: tagged.runtimeErrors?.map((e) => ({
      ...e,
      message: truncate(e.message, 200),
      stack: undefined,
      file: undefined,
      line: undefined,
      col: undefined,
    })),
    networkRequestSummaries: tagged.networkRequestSummaries?.map((row) => ({
      ...row,
      statusText: row.statusText ? truncate(row.statusText, 60) : undefined,
      requestId: undefined,
      correlationId: undefined,
    })),
    element: tagged.element
      ? {
          ...tagged.element,
          safeAttributes: tagged.element.safeAttributes
            ? truncate(tagged.element.safeAttributes, 200)
            : tagged.element.safeAttributes,
        }
      : undefined,
    targetDomHint: tagged.targetDomHint
      ? {
          ...tagged.targetDomHint,
          ariaLabel: tagged.targetDomHint.ariaLabel
            ? truncate(tagged.targetDomHint.ariaLabel, 80)
            : tagged.targetDomHint.ariaLabel,
          textHint: tagged.targetDomHint.textHint
            ? truncate(tagged.targetDomHint.textHint, 80)
            : tagged.targetDomHint.textHint,
          selectorHint: tagged.targetDomHint.selectorHint
            ? truncate(tagged.targetDomHint.selectorHint, 100)
            : tagged.targetDomHint.selectorHint,
        }
      : undefined,
  };
}
