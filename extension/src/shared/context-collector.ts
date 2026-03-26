import type {
  CapturedIssueContextV1,
  ElementContext,
  InteractionTimelineEntryV1,
  PerformanceSignalsSnapshotV1,
  RuntimeErrorSnapshotV1,
  TargetDomHintV1,
  VisualStateSnapshotV1,
} from "./types";
import { CAPTURE_LIMITS } from "./context-limits";
import { pickNetworkSummariesForIssue, summariesToFailedRequests } from "./network-summary";
import {
  attachNetworkRequestCorrelation,
  enrichAndOrderRuntimeErrors,
  lastMeaningfulTimelineAnchor,
} from "./session-correlation";
import { tryGetExtensionResourceUrl } from "./extension-runtime";
import { resolvePageRouteInfo } from "./page-route-context";
import { sanitizeElementAttributes, sanitizeUrl, truncate } from "./sanitizer";
import { applyCaptureModeToContext, normalizeCaptureMode } from "./capture-mode";
import { detectSensitiveFindings } from "./sensitive-findings";
import type { CaptureModeV1 } from "./types";
import { buildViewModeHint } from "./view-layout-hint";
import { elementIsInsideExtensionUi } from "./extension-constants";
import { captureAppEnvironment } from "./app-environment-capture";

const SNAP_EVENT = "qa-feedback:snapshot";

/** Linha bruta vinda do `page-bridge` (URL ainda não sanitizada). */
export type BridgeNetworkRow = {
  at: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  aborted?: boolean;
  statusText?: string;
  requestId?: string;
  correlationId?: string;
  contentType?: string;
};

export type BridgeSnapshot = {
  console: { level: "error" | "warn" | "log"; message: string }[];
  networkSummaries: BridgeNetworkRow[];
  interactionTimeline: InteractionTimelineEntryV1[];
  runtimeErrors: RuntimeErrorSnapshotV1[];
  performanceSignals?: PerformanceSignalsSnapshotV1;
};

let latestBridge: BridgeSnapshot = {
  console: [],
  networkSummaries: [],
  interactionTimeline: [],
  runtimeErrors: [],
  performanceSignals: undefined,
};
let bridgeListenerAttached = false;

function networkRowsFromBridgeDetail(d: {
  networkSummaries?: BridgeNetworkRow[];
  failedRequests?: { method: string; url: string; status: number; message: string }[];
}): BridgeNetworkRow[] {
  const n = d.networkSummaries;
  if (n && n.length) return n;
  const f = d.failedRequests;
  if (!f?.length) return [];
  return f.map((x) => ({
    at: new Date().toISOString(),
    method: x.method,
    url: x.url,
    status: x.status,
    durationMs: 0,
    statusText: x.message,
  }));
}

type BridgeEventDetail = {
  console?: BridgeSnapshot["console"];
  runtimeErrors?: RuntimeErrorSnapshotV1[];
  performanceSignals?: PerformanceSignalsSnapshotV1;
  failedRequests?: { method: string; url: string; status: number; message: string }[];
  networkSummaries?: BridgeNetworkRow[];
  interactionTimeline?: InteractionTimelineEntryV1[];
};

function onSnap(ev: Event): void {
  const e = ev as CustomEvent<BridgeEventDetail>;
  if (!e.detail) return;
  const d = e.detail;
  const merged = networkRowsFromBridgeDetail(d);
  latestBridge = {
    console: (d.console ?? []).slice(-CAPTURE_LIMITS.issueConsoleEntries),
    networkSummaries: merged.slice(-CAPTURE_LIMITS.bridgeNetworkBuffer),
    interactionTimeline: (d.interactionTimeline ?? []).slice(-CAPTURE_LIMITS.issueTimelineEntries),
    runtimeErrors: (d.runtimeErrors ?? []).slice(-CAPTURE_LIMITS.issueRuntimeErrorEntries),
    performanceSignals: d.performanceSignals,
  };
}

/**
 * Injeta bridge no MAIN world via ficheiro da extensão (compatível com CSP sem unsafe-inline).
 */
export function ensurePageBridgeInjected(): void {
  if (!bridgeListenerAttached) {
    document.addEventListener(SNAP_EVENT, onSnap as EventListener);
    bridgeListenerAttached = true;
  }

  const root = document.documentElement as HTMLElement;
  if (root.dataset.qaFeedbackBridgeScript === "1" || root.dataset.qaFeedbackBridgeScript === "loading") {
    return;
  }
  root.dataset.qaFeedbackBridgeScript = "loading";

  const url = tryGetExtensionResourceUrl("page-bridge.js");
  if (!url) {
    delete root.dataset.qaFeedbackBridgeScript;
    return;
  }

  const script = document.createElement("script");
  script.src = url;
  script.async = true;
  script.onload = () => {
    root.dataset.qaFeedbackBridgeScript = "1";
    script.remove();
  };
  script.onerror = () => {
    delete root.dataset.qaFeedbackBridgeScript;
  };
  (document.documentElement || document.head).appendChild(script);
}

export function readBridgeSnapshot(): BridgeSnapshot {
  try {
    ensurePageBridgeInjected();
  } catch {
    /* ex.: contexto invalidado durante injeção */
  }
  return {
    console: latestBridge.console.slice(-CAPTURE_LIMITS.issueConsoleEntries),
    networkSummaries: latestBridge.networkSummaries.slice(-CAPTURE_LIMITS.bridgeNetworkBuffer),
    interactionTimeline: latestBridge.interactionTimeline.slice(-CAPTURE_LIMITS.issueTimelineEntries),
    runtimeErrors: latestBridge.runtimeErrors.slice(-CAPTURE_LIMITS.issueRuntimeErrorEntries),
    performanceSignals: latestBridge.performanceSignals,
  };
}

export function captureElementContext(el: Element | null): ElementContext | undefined {
  if (!el || !(el instanceof Element)) return undefined;
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || "",
    classes: typeof el.className === "string" ? el.className : "",
    safeAttributes: sanitizeElementAttributes(el),
  };
}

function isElementVisible(el: Element): boolean {
  try {
    if (!(el instanceof HTMLElement)) return true;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    return true;
  } catch {
    return false;
  }
}

function safeText(el: Element, max = 120): string | undefined {
  try {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) return undefined;
    return truncate(t, max);
  } catch {
    return undefined;
  }
}

function findAriaLabelForBy(el: Element): string | undefined {
  const labelId = (el as Element).getAttribute("aria-labelledby");
  if (!labelId) return undefined;
  const id = labelId.split(/\s+/g)[0]?.trim();
  if (!id) return undefined;
  const ref = document.getElementById(id);
  if (!ref) return undefined;
  return safeText(ref, 140);
}

function captureDialogSnapshots(maxDialogs = 3): VisualStateSnapshotV1["dialogs"] | undefined {
  try {
    const selectors = [
      '[role="dialog"][aria-modal="true"]',
      '[aria-modal="true"]',
      '[role="alertdialog"]',
    ].join(",");
    const nodes = Array.from(document.querySelectorAll(selectors)).filter(
      (n) => n instanceof Element && isElementVisible(n) && !elementIsInsideExtensionUi(n),
    );
    if (!nodes.length) return undefined;
    const out = nodes.slice(0, maxDialogs).map((d) => {
      const aLabel = (d as HTMLElement).getAttribute("aria-label") || undefined;
      const byLabel = findAriaLabelForBy(d);
      const title = aLabel ?? byLabel ?? safeText(d, 80);
      const type = (d.getAttribute("role") || d.getAttribute("aria-modal") || "dialog").toString();
      return { type, title: title ? truncate(title, 90) : undefined };
    });
    return out;
  } catch {
    return undefined;
  }
}

function captureBusyIndicators(max = 3): VisualStateSnapshotV1["busyIndicators"] | undefined {
  try {
    const busyNodes = Array.from(document.querySelectorAll('[aria-busy="true"]')).filter(
      (n) => n instanceof Element && isElementVisible(n) && !elementIsInsideExtensionUi(n),
    );
    const out: string[] = [];
    for (const n of busyNodes) {
      const lbl =
        (n as HTMLElement).getAttribute("aria-label") ||
        safeText(n, 60) ||
        (n as HTMLElement).getAttribute("role") ||
        n.tagName.toLowerCase();
      out.push(truncate(String(lbl), 80));
      if (out.length >= max) break;
    }
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

function captureActiveTabs(max = 3): VisualStateSnapshotV1["activeTabs"] | undefined {
  try {
    const nodes = Array.from(
      document.querySelectorAll('[role="tab"][aria-selected="true"]'),
    ).filter((n) => n instanceof Element && isElementVisible(n) && !elementIsInsideExtensionUi(n));
    if (!nodes.length) return undefined;
    const out: string[] = [];
    for (const n of nodes) {
      const lbl = (n as HTMLElement).getAttribute("aria-label") || safeText(n, 90);
      const fallback = (n as HTMLElement).id ? `#${(n as HTMLElement).id}` : n.tagName.toLowerCase();
      out.push(truncate(lbl || fallback, 120));
      if (out.length >= max) break;
    }
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

function captureTargetDomHint(el: Element | null): TargetDomHintV1 | undefined {
  if (!el || !(el instanceof Element)) return undefined;
  if (elementIsInsideExtensionUi(el)) return undefined;

  const tag = el.tagName.toLowerCase();
  const role = (el as HTMLElement).getAttribute("role") || undefined;
  const ariaLabel = (el as HTMLElement).getAttribute("aria-label") || undefined;
  const dataTestId =
    (el as HTMLElement).getAttribute("data-testid") ||
    (el as HTMLElement).getAttribute("data-qa") ||
    undefined;
  const id = el.id || undefined;
  const textHint = safeText(el, 110);

  let selectorHint: string | undefined;
  if (dataTestId) selectorHint = `${tag}[data-testid="${truncate(dataTestId, 60)}"]`;
  else if (id) selectorHint = `${tag}#${truncate(id, 60)}`;
  else {
    const cls = (el as HTMLElement).className;
    if (typeof cls === "string" && cls.trim()) {
      const parts = cls.split(/\s+/g).filter(Boolean).slice(0, 2);
      if (parts.length) selectorHint = `${tag}.${parts.map((p) => truncate(p, 30)).join(".")}`;
    }
  }

  let rect: TargetDomHintV1["rect"] | undefined;
  try {
    if (el instanceof HTMLElement) {
      const r = el.getBoundingClientRect();
      rect = { w: Math.round(r.width), h: Math.round(r.height) };
      if (rect.w <= 0 || rect.h <= 0) rect = undefined;
    }
  } catch {
    rect = undefined;
  }

  const any =
    selectorHint || role || ariaLabel || textHint || rect
      ? true
      : false;
  if (!any) return undefined;

  return {
    selectorHint,
    role,
    ariaLabel,
    textHint,
    rect,
  };
}

export function buildCapturedIssueContext(params: {
  lastTarget: Element | null;
  bridge: BridgeSnapshot;
  captureMode?: CaptureModeV1;
}): CapturedIssueContextV1 {
  const { lastTarget, bridge, captureMode: captureModeRaw } = params;
  const captureMode = normalizeCaptureMode(captureModeRaw);
  const url = sanitizeUrl(window.location.href);
  const route = resolvePageRouteInfo(window.location);

  let pointerCoarse = false;
  try {
    pointerCoarse = window.matchMedia("(pointer: coarse)").matches;
  } catch {
    /* ignore */
  }
  const mtp = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0;
  const iw = window.innerWidth;
  const ih = window.innerHeight;

  const mappedSummaries = bridge.networkSummaries.map((r) => ({
    at: r.at,
    method: r.method,
    url: sanitizeUrl(r.url),
    status: r.status,
    durationMs: r.durationMs,
    aborted: r.aborted,
    statusText: r.statusText ? truncate(r.statusText, 120) : undefined,
    requestId: r.requestId ? truncate(r.requestId, 64) : undefined,
    correlationId: r.correlationId ? truncate(r.correlationId, 64) : undefined,
    responseContentType: r.contentType ? truncate(r.contentType, 80) : undefined,
  }));

  const anchor = lastMeaningfulTimelineAnchor(bridge.interactionTimeline);
  const correlatedSummaries = attachNetworkRequestCorrelation(
    mappedSummaries,
    anchor,
    CAPTURE_LIMITS.correlationWindowAfterActionMs,
  );

  const picked = pickNetworkSummariesForIssue(
    correlatedSummaries,
    CAPTURE_LIMITS.issueNetworkSummaryMax,
    CAPTURE_LIMITS.networkSlowThresholdMs,
  );

  const networkRequestSummaries = picked.length ? picked : undefined;
  const failedRequests = summariesToFailedRequests(picked, CAPTURE_LIMITS.issueFailedRequests);

  let runtimeErrors: RuntimeErrorSnapshotV1[] | undefined;
  if (bridge.runtimeErrors?.length) {
    runtimeErrors = enrichAndOrderRuntimeErrors(
      bridge.runtimeErrors.map((e) => ({ ...e })),
      anchor,
      CAPTURE_LIMITS.correlationWindowAfterActionMs,
    );
  }

  let appEnvironment: CapturedIssueContextV1["appEnvironment"];
  try {
    appEnvironment = captureAppEnvironment(window);
  } catch {
    appEnvironment = undefined;
  }

  const captured: CapturedIssueContextV1 = {
    version: 1 as const,
    page: {
      url,
      pathname: route.pathname,
      routeSearch: route.routeSearch,
      routeSlug: route.routeSlug,
      routeLabel: route.routeLabel,
      routeKey: route.routeKey,
      title: truncate(document.title || "", 200),
      userAgent: truncate(navigator.userAgent, 400),
      timestamp: new Date().toISOString(),
      viewport: `${iw}x${ih}`,
      screenCss: `${screen.width}x${screen.height}`,
      devicePixelRatio: String(window.devicePixelRatio ?? 1),
      maxTouchPoints: mtp,
      pointerCoarse,
      viewModeHint: buildViewModeHint({
        innerWidth: iw,
        innerHeight: ih,
        screenWidth: screen.width,
        screenHeight: screen.height,
        maxTouchPoints: mtp,
        pointerCoarse,
      }),
    },
    element: captureElementContext(lastTarget),
    visualState:
      // Só calcula se existir um alvo; ajuda a evitar queries em caso de envio “vazio”.
      lastTarget
        ? {
            dialogs: captureDialogSnapshots(3),
            busyIndicators: captureBusyIndicators(3),
            activeTabs: captureActiveTabs(3),
          }
        : undefined,
    targetDomHint: captureTargetDomHint(lastTarget),
    console: bridge.console.map((c) => ({
      level: c.level,
      message: truncate(c.message, 400),
    })),
    failedRequests,
    ...(runtimeErrors ? { runtimeErrors } : {}),
    ...(bridge.performanceSignals && Object.keys(bridge.performanceSignals).length
      ? { performanceSignals: bridge.performanceSignals }
      : {}),
    ...(networkRequestSummaries ? { networkRequestSummaries } : {}),
    ...(bridge.interactionTimeline.length
      ? {
          interactionTimeline: bridge.interactionTimeline.map((t) => ({
            at: t.at,
            kind: t.kind,
            summary: truncate(t.summary, 220),
          })),
        }
      : {}),
    ...(appEnvironment ? { appEnvironment } : {}),
  };
  const sensitiveFindings = detectSensitiveFindings(captured);
  const merged: CapturedIssueContextV1 = sensitiveFindings.length
    ? { ...captured, sensitiveFindings }
    : captured;
  return applyCaptureModeToContext(merged, captureMode);
}
