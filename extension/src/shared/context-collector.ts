import type { CapturedIssueContextV1, ElementContext } from "./types";
import { CAPTURE_LIMITS } from "./context-limits";
import { tryGetExtensionResourceUrl } from "./extension-runtime";
import { resolvePageRouteInfo } from "./page-route-context";
import { sanitizeElementAttributes, sanitizeUrl, truncate } from "./sanitizer";
import { buildViewModeHint } from "./view-layout-hint";

const SNAP_EVENT = "qa-feedback:snapshot";

export type BridgeSnapshot = {
  console: { level: "error" | "warn" | "log"; message: string }[];
  failedRequests: { method: string; url: string; status: number; message: string }[];
};

let latestBridge: BridgeSnapshot = { console: [], failedRequests: [] };
let bridgeListenerAttached = false;

function onSnap(ev: Event): void {
  const e = ev as CustomEvent<BridgeSnapshot>;
  if (!e.detail) return;
  latestBridge = {
    console: (e.detail.console ?? []).slice(-CAPTURE_LIMITS.issueConsoleEntries),
    failedRequests: (e.detail.failedRequests ?? []).slice(-CAPTURE_LIMITS.issueFailedRequests),
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
    failedRequests: latestBridge.failedRequests.slice(-CAPTURE_LIMITS.issueFailedRequests),
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
    failedRequests: bridge.failedRequests.map((r) => ({
      method: r.method,
      url: sanitizeUrl(r.url),
      status: r.status,
      message: truncate(r.message, 200),
    })),
  };
}
