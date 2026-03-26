import type { AppEnvironmentSnapshotV1, CapturedIssueContextV1, CaptureModeV1 } from "./types";
import { CAPTURE_LIMITS } from "./context-limits";
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

  const envTrim = (e: AppEnvironmentSnapshotV1 | undefined): AppEnvironmentSnapshotV1 | undefined => {
    if (!e) return undefined;
    const maxScalar = 72;
    const maxFlagVal = 36;
    const maxFlags = Math.min(6, CAPTURE_LIMITS.appEnvFlagsMax);
    const scalar = (s: string | undefined, m: number) => (s ? truncate(s, m) : undefined);
    const flags = e.featureFlags?.slice(0, maxFlags).map((x) => ({
      key: truncate(x.key, CAPTURE_LIMITS.appEnvFlagKeyMax),
      value: truncate(x.value, maxFlagVal),
    }));
    const exps = e.experiments?.slice(0, maxFlags).map((x) => ({
      key: truncate(x.key, CAPTURE_LIMITS.appEnvFlagKeyMax),
      value: truncate(x.value, maxFlagVal),
    }));
    const out: AppEnvironmentSnapshotV1 = {
      appName: scalar(e.appName, maxScalar),
      environmentName: scalar(e.environmentName, maxScalar),
      buildId: scalar(e.buildId, maxScalar),
      release: scalar(e.release, maxScalar),
      commitSha: scalar(e.commitSha, CAPTURE_LIMITS.appEnvCommitMax),
      tenant: scalar(e.tenant, 48),
      role: scalar(e.role, 48),
      ...(flags?.length ? { featureFlags: flags } : {}),
      ...(exps?.length ? { experiments: exps } : {}),
    };
    const hasAny =
      Boolean(out.appName) ||
      Boolean(out.environmentName) ||
      Boolean(out.buildId) ||
      Boolean(out.release) ||
      Boolean(out.commitSha) ||
      Boolean(out.tenant) ||
      Boolean(out.role) ||
      (out.featureFlags?.length ?? 0) > 0 ||
      (out.experiments?.length ?? 0) > 0;
    return hasAny ? out : undefined;
  };

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
    appEnvironment: envTrim(tagged.appEnvironment),
  };
}
