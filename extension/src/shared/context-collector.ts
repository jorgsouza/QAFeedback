import type { ElementContext, TechnicalContextPayload } from "./types";
import { tryGetExtensionResourceUrl } from "./extension-runtime";
import { sanitizeElementAttributes, sanitizeUrl, truncate } from "./sanitizer";

const MAX_CONSOLE = 8;
const MAX_FAILED = 5;
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
    console: (e.detail.console ?? []).slice(-MAX_CONSOLE),
    failedRequests: (e.detail.failedRequests ?? []).slice(-MAX_FAILED),
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
    console: latestBridge.console.slice(-MAX_CONSOLE),
    failedRequests: latestBridge.failedRequests.slice(-MAX_FAILED),
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

export function buildTechnicalContext(params: {
  lastTarget: Element | null;
  bridge: BridgeSnapshot;
}): TechnicalContextPayload {
  const { lastTarget, bridge } = params;
  const url = sanitizeUrl(window.location.href);
  return {
    page: {
      url,
      title: truncate(document.title || "", 200),
      userAgent: truncate(navigator.userAgent, 400),
      timestamp: new Date().toISOString(),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
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
