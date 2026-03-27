/**
 * PRD-011 Fase 7 — agregado estável para futura classificação / título por IA (sem chamada a modelo).
 * O Markdown da issue (`issue-builder`) não depende deste módulo.
 */
import { CAPTURE_LIMITS } from "./context-limits";
import { pickNetworkSummariesForIssue } from "./network-summary";
import { lastMeaningfulTimelineAnchor } from "./session-correlation";
import type {
  CaptureModeV1,
  CreateIssuePayload,
  InteractionTimelineKindV1,
  SensitiveFindingKindV1,
} from "./types";

export const IA_ISSUE_INPUT_SCHEMA_VERSION = 1 as const;

/** Última âncora “forte” na timeline (clique / submit / navegação), alinhada a `session-correlation`. */
export type IaIssuePrimaryActionV1 = {
  kind: InteractionTimelineKindV1;
  summary: string;
  at: string;
};

/** Pedido HTTP prioritário (mesma ordenação que `pickNetworkSummariesForIssue` sobre o buffer da issue). */
export type IaIssuePrimaryRequestV1 = {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  isCorrelated?: boolean;
};

/** Erro de runtime destacado (último da lista enriquecida no contexto, como em `issue-builder`). */
export type IaIssuePrimaryRuntimeErrorV1 = {
  kind: "error" | "unhandledrejection";
  message: string;
  at: string;
};

export type IaIssueVisualStateSummaryV1 = {
  dialogCount: number;
  busyIndicatorCount: number;
  activeTabCount: number;
};

/** Subconjunto do ambiente da app (sem flags completas — só rótulos estáveis para classificação). */
export type IaIssueAppEnvironmentSummaryV1 = {
  appName?: string;
  environmentName?: string;
  buildId?: string;
  release?: string;
  commitSha?: string;
  tenant?: string;
  role?: string;
};

/** Resumo de achados sensíveis: contagens e tipos estáveis, sem valores brutos. */
export type IaIssueSensitiveFindingsSummaryV1 = {
  count: number;
  /** Ordenação lexicográfica para `JSON.stringify` determinístico. */
  kinds: SensitiveFindingKindV1[];
};

/**
 * Contrato versionado do input agregado para IA.
 * Campos técnicos são `null` quando não há `capturedContext`.
 */
export type IaIssueInputV1 = {
  schemaVersion: typeof IA_ISSUE_INPUT_SCHEMA_VERSION;
  includeTechnicalContext: boolean;
  captureMode: CaptureModeV1 | null;
  userNarrative: { title: string; whatHappened: string };
  pageRoute: { routeKey: string; routeLabel: string; pathname: string } | null;
  primaryAction: IaIssuePrimaryActionV1 | null;
  primaryRequest: IaIssuePrimaryRequestV1 | null;
  primaryRuntimeError: IaIssuePrimaryRuntimeErrorV1 | null;
  visualState: IaIssueVisualStateSummaryV1 | null;
  appEnvironment: IaIssueAppEnvironmentSummaryV1 | null;
  sensitiveFindings: IaIssueSensitiveFindingsSummaryV1 | null;
  networkRequestCount: number;
  timelineEntryCount: number;
};

function primaryRequestFromContext(
  summaries: NonNullable<CreateIssuePayload["capturedContext"]>["networkRequestSummaries"],
): IaIssuePrimaryRequestV1 | null {
  if (!summaries?.length) return null;
  const picked = pickNetworkSummariesForIssue(
    summaries,
    CAPTURE_LIMITS.issueNetworkSummaryMax,
    CAPTURE_LIMITS.networkSlowThresholdMs,
  );
  const first = picked[0];
  if (!first) return null;
  return {
    method: first.method,
    url: first.url,
    status: first.status,
    durationMs: first.durationMs,
    ...(first.isCorrelated === true ? { isCorrelated: true } : {}),
  };
}

function appEnvSummary(
  env: NonNullable<NonNullable<CreateIssuePayload["capturedContext"]>["appEnvironment"]>,
): IaIssueAppEnvironmentSummaryV1 {
  const out: IaIssueAppEnvironmentSummaryV1 = {};
  if (env.appName) out.appName = env.appName;
  if (env.environmentName) out.environmentName = env.environmentName;
  if (env.buildId) out.buildId = env.buildId;
  if (env.release) out.release = env.release;
  if (env.commitSha) out.commitSha = env.commitSha;
  if (env.tenant) out.tenant = env.tenant;
  if (env.role) out.role = env.role;
  return out;
}

function findingsSummary(
  findings: NonNullable<NonNullable<CreateIssuePayload["capturedContext"]>["sensitiveFindings"]>,
): IaIssueSensitiveFindingsSummaryV1 | null {
  if (!findings.length) return null;
  const kinds = [...new Set(findings.map((f) => f.kind))].sort((a, b) => a.localeCompare(b));
  return { count: findings.length, kinds };
}

/**
 * Monta o agregado v1 a partir do payload de criação (mesmos dados que alimentam a issue).
 * Puramente local; não altera `payload`.
 */
export function buildIaIssueInputV1(payload: CreateIssuePayload): IaIssueInputV1 {
  const ctx = payload.capturedContext;

  if (!ctx) {
    return {
      schemaVersion: IA_ISSUE_INPUT_SCHEMA_VERSION,
      includeTechnicalContext: payload.includeTechnicalContext,
      captureMode: null,
      userNarrative: { title: payload.title, whatHappened: payload.whatHappened },
      pageRoute: null,
      primaryAction: null,
      primaryRequest: null,
      primaryRuntimeError: null,
      visualState: null,
      appEnvironment: null,
      sensitiveFindings: null,
      networkRequestCount: 0,
      timelineEntryCount: 0,
    };
  }

  const anchor = lastMeaningfulTimelineAnchor(ctx.interactionTimeline ?? []);
  const primaryAction: IaIssuePrimaryActionV1 | null = anchor
    ? { kind: anchor.kind, summary: anchor.summary, at: anchor.at }
    : null;

  const re = ctx.runtimeErrors ?? [];
  const lastErr = re.length ? re[re.length - 1]! : undefined;
  const primaryRuntimeError: IaIssuePrimaryRuntimeErrorV1 | null = lastErr
    ? { kind: lastErr.kind, message: lastErr.message, at: lastErr.at }
    : null;

  const vis = ctx.visualState;
  const visualState: IaIssueVisualStateSummaryV1 | null =
    vis && (vis.dialogs?.length || vis.busyIndicators?.length || vis.activeTabs?.length)
      ? {
          dialogCount: vis.dialogs?.length ?? 0,
          busyIndicatorCount: vis.busyIndicators?.length ?? 0,
          activeTabCount: vis.activeTabs?.length ?? 0,
        }
      : null;

  const env = ctx.appEnvironment;
  const appEnvironment: IaIssueAppEnvironmentSummaryV1 | null =
    env && Object.keys(appEnvSummary(env)).length ? appEnvSummary(env) : null;

  const sf = ctx.sensitiveFindings;
  const sensitiveFindings = sf?.length ? findingsSummary(sf) : null;

  const summaries = ctx.networkRequestSummaries ?? [];
  const timeline = ctx.interactionTimeline ?? [];

  return {
    schemaVersion: IA_ISSUE_INPUT_SCHEMA_VERSION,
    includeTechnicalContext: payload.includeTechnicalContext,
    captureMode: ctx.captureMode ?? null,
    userNarrative: { title: payload.title, whatHappened: payload.whatHappened },
    pageRoute: {
      routeKey: ctx.page.routeKey,
      routeLabel: ctx.page.routeLabel,
      pathname: ctx.page.pathname,
    },
    primaryAction,
    primaryRequest: primaryRequestFromContext(summaries),
    primaryRuntimeError,
    visualState,
    appEnvironment,
    sensitiveFindings,
    networkRequestCount: summaries.length,
    timelineEntryCount: timeline.length,
  };
}
