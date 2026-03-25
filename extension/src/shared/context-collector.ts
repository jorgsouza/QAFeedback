import type { CapturedIssueContextV1, ElementContext, InteractionTimelineEntryV1 } from "./types";
import { CAPTURE_LIMITS } from "./context-limits";
import { pickNetworkSummariesForIssue, summariesToFailedRequests } from "./network-summary";
import { tryGetExtensionResourceUrl } from "./extension-runtime";
import { resolvePageRouteInfo } from "./page-route-context";
import { sanitizeElementAttributes, sanitizeUrl, truncate } from "./sanitizer";
import { buildViewModeHint } from "./view-layout-hint";

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
};

let latestBridge: BridgeSnapshot = { console: [], networkSummaries: [], interactionTimeline: [] };
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

export function buildCapturedIssueContext(params: {
  lastTarget: Element | null;
  bridge: BridgeSnapshot;
}): CapturedIssueContextV1 {
  const { lastTarget, bridge } = params;
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

  const picked = pickNetworkSummariesForIssue(
    mappedSummaries,
    CAPTURE_LIMITS.issueNetworkSummaryMax,
    CAPTURE_LIMITS.networkSlowThresholdMs,
  );

  const networkRequestSummaries = picked.length ? picked : undefined;
  const failedRequests = summariesToFailedRequests(picked, CAPTURE_LIMITS.issueFailedRequests);

  return {
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
    console: bridge.console.map((c) => ({
      level: c.level,
      message: truncate(c.message, 400),
    })),
    failedRequests,
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
  };
}
