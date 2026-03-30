/**
 * Roda no MAIN world (via <script src="chrome-extension://.../page-bridge.js">).
 * Evita CSP `script-src` contra inline; o host costuma permitir extensão em script-src.
 */
import { CAPTURE_LIMITS } from "../shared/context-limits";
import {
  eventPathTouchesQaExtensionHost,
  eventTargetElement,
  signatureDialogTitles,
  summarizeClickTarget,
  summarizeFormFieldTimeline,
  summarizeKeydownTimeline,
  summarizeSubmitTarget,
  summarizeTabSectionSelection,
} from "../shared/interaction-timeline";
import { isBrowserExtensionSchemeUrl } from "../shared/network-summary";
import type {
  InteractionTimelineEntryV1,
  InteractionTimelineKindV1,
  PerformanceSignalsSnapshotV1,
  RuntimeErrorSnapshotV1,
} from "../shared/types";

const SNAP_EVENT = "qa-feedback:snapshot";

type NetworkBridgeRow = {
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

type BridgeDetail = {
  console: { level: "error" | "warn" | "log"; message: string }[];
  /** Legado: bridge antigo só enviava falhas */
  failedRequests?: { method: string; url: string; status: number; message: string }[];
  networkSummaries?: NetworkBridgeRow[];
  runtimeErrors?: RuntimeErrorSnapshotV1[];
  performanceSignals?: PerformanceSignalsSnapshotV1;
  interactionTimeline: InteractionTimelineEntryV1[];
};

function cap<T>(arr: T[], n: number): T[] {
  return arr.slice(-n);
}

/** Evita «Refused to get unsafe header» / exceções em XHR cross-origin (ex.: www → API noutro host). */
function requestUrlSameOriginAsPage(requestUrl: string, pageHref: string): boolean {
  try {
    const u = new URL(requestUrl, pageHref);
    return u.origin === new URL(pageHref).origin;
  } catch {
    return false;
  }
}

function safeXhrGetResponseHeader(xhr: XMLHttpRequest, name: string): string | null {
  try {
    return xhr.getResponseHeader(name);
  } catch {
    return null;
  }
}

function readCorrelationHeadersFromResponse(res: Response): {
  requestId?: string;
  correlationId?: string;
  contentType?: string;
} {
  try {
    let requestId: string | undefined;
    let correlationId: string | undefined;
    let contentType: string | undefined;
    const sameOrigin = requestUrlSameOriginAsPage(res.url, typeof location !== "undefined" ? location.href : "");
    if (sameOrigin) {
      requestId =
        res.headers.get("x-request-id") ||
        res.headers.get("x-requestid") ||
        res.headers.get("request-id") ||
        undefined;
      correlationId =
        res.headers.get("x-correlation-id") ||
        res.headers.get("correlation-id") ||
        res.headers.get("x-amzn-requestid") ||
        undefined;
    }
    const ct = res.headers.get("content-type");
    if (ct) contentType = ct.split(";")[0]?.trim();
    return {
      requestId: requestId || undefined,
      correlationId: correlationId || undefined,
      contentType: contentType || undefined,
    };
  } catch {
    return {};
  }
}

function init(): void {
  const root = document.documentElement;
  if (!root || root.getAttribute("data-qa-feedback-main-bridge") === "1") return;
  root.setAttribute("data-qa-feedback-main-bridge", "1");

  const state = {
    console: [] as { level: "error" | "warn" | "log"; message: string }[],
    networkSummaries: [] as NetworkBridgeRow[],
    timeline: [] as InteractionTimelineEntryV1[],
    runtimeErrors: [] as RuntimeErrorSnapshotV1[],
    performanceSignals: {} as PerformanceSignalsSnapshotV1,
  };

  const lastInputAtByField = new Map<string, number>();

  const runtimeErrorsByKey = new Map<string, RuntimeErrorSnapshotV1>();
  const runtimeErrorOrder: string[] = [];

  function pushRuntimeError(entry: Omit<RuntimeErrorSnapshotV1, "at" | "count">): void {
    const stackPrefix = entry.stack ? entry.stack.slice(0, 120) : "";
    const key = `${entry.kind}|${entry.message}|${stackPrefix}`;
    const at = new Date().toISOString();
    const existing = runtimeErrorsByKey.get(key);
    if (existing) {
      existing.at = at;
      existing.count = (existing.count ?? 1) + 1;
      existing.file = entry.file;
      existing.line = entry.line;
      existing.col = entry.col;
      // deltaToLastClickMs é calculado no content script
      emit();
      return;
    }

    const next: RuntimeErrorSnapshotV1 = { ...entry, at, count: 1 };
    runtimeErrorsByKey.set(key, next);
    runtimeErrorOrder.push(key);

    while (runtimeErrorOrder.length > CAPTURE_LIMITS.bridgeRuntimeErrorBuffer) {
      const drop = runtimeErrorOrder.shift();
      if (drop) runtimeErrorsByKey.delete(drop);
    }

    state.runtimeErrors = runtimeErrorOrder
      .map((k) => runtimeErrorsByKey.get(k))
      .filter((x): x is RuntimeErrorSnapshotV1 => Boolean(x));
    emit();
  }

  function pushNetworkEntry(row: NetworkBridgeRow): void {
    if (isBrowserExtensionSchemeUrl(row.url)) return;
    state.networkSummaries = cap(
      [...state.networkSummaries, row],
      CAPTURE_LIMITS.bridgeNetworkBuffer,
    );
    emit();
  }

  function fieldThrottleKey(el: HTMLElement): string {
    if (el instanceof HTMLInputElement)
      return `i:${el.type}:${el.name}:${el.id}`;
    if (el instanceof HTMLTextAreaElement) return `t:${el.name}:${el.id}`;
    return `o:${el.tagName}`;
  }

  function pushTimeline(entry: { kind: InteractionTimelineKindV1; summary: string }): void {
    const at = new Date().toISOString();
    const last = state.timeline[state.timeline.length - 1];
    if (last && last.kind === entry.kind && last.summary === entry.summary) {
      const dt = Date.now() - new Date(last.at).getTime();
      if (dt >= 0 && dt < CAPTURE_LIMITS.timelineDedupeMs) return;
    }
    state.timeline = cap(
      [...state.timeline, { at, kind: entry.kind, summary: entry.summary }],
      CAPTURE_LIMITS.bridgeTimelineBuffer,
    );
    emit();
  }

  function emit(): void {
    const detail: BridgeDetail = {
      console: cap(state.console, CAPTURE_LIMITS.bridgeConsoleBuffer).slice(
        -CAPTURE_LIMITS.issueConsoleEntries,
      ),
      networkSummaries: cap(state.networkSummaries, CAPTURE_LIMITS.bridgeNetworkBuffer),
      runtimeErrors: cap(state.runtimeErrors, CAPTURE_LIMITS.bridgeRuntimeErrorBuffer).slice(
        -CAPTURE_LIMITS.issueRuntimeErrorEntries,
      ),
      performanceSignals: state.performanceSignals,
      interactionTimeline: cap(state.timeline, CAPTURE_LIMITS.bridgeTimelineBuffer).slice(
        -CAPTURE_LIMITS.issueTimelineEntries,
      ),
    };
    document.dispatchEvent(new CustomEvent(SNAP_EVENT, { bubbles: true, detail }));
  }

  (["error", "warn", "log"] as const).forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        const message = args.map((a) => String(a)).join(" ");
        state.console = cap([...state.console, { level, message }], CAPTURE_LIMITS.bridgeConsoleBuffer);
        emit();
      } catch {
        /* ignore */
      }
      return orig(...args);
    };
  });

  // Runtime errors: janela e promessas rejeitadas (best-effort).
  window.addEventListener("error", (ev: ErrorEvent) => {
    try {
      const message = ev.message ? String(ev.message) : "runtime error";
      const stack =
        ev.error && (ev.error as Error).stack ? String((ev.error as Error).stack) : undefined;
      pushRuntimeError({
        kind: "error",
        message,
        stack,
        file: ev.filename,
        line: typeof ev.lineno === "number" ? ev.lineno : undefined,
        col: typeof ev.colno === "number" ? ev.colno : undefined,
      });
    } catch {
      /* ignore */
    }
  });

  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    try {
      const reason = ev.reason;
      const isErr = reason instanceof Error;
      const message = isErr
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "unhandled rejection";
      const stack = isErr && reason.stack ? String(reason.stack) : undefined;
      pushRuntimeError({
        kind: "unhandledrejection",
        message,
        stack,
      });
    } catch {
      /* ignore */
    }
  });

  // Performance signals: LCP/INP/CLS/long tasks (best-effort).
  let perfLastEmitAt = 0;
  function maybeEmitPerf(): void {
    const now = Date.now();
    if (now - perfLastEmitAt < CAPTURE_LIMITS.performanceEmitMinMs) return;
    perfLastEmitAt = now;
    emit();
  }

  function tryStartPerformanceObservers(): void {
    try {
      if (typeof PerformanceObserver !== "function") return;
      const supported = PerformanceObserver.supportedEntryTypes ?? [];

      if (supported.includes("largest-contentful-paint")) {
        new PerformanceObserver((list) => {
          try {
            for (const e of list.getEntries() as any[]) {
              const t = Number(e.renderTime ?? e.startTime);
              if (!Number.isFinite(t)) continue;
              state.performanceSignals.lcpMs = t;
              state.performanceSignals.lcpAt = new Date().toISOString();
              maybeEmitPerf();
            }
          } catch {
            /* ignore */
          }
        }).observe({ type: "largest-contentful-paint", buffered: true } as any);
      }

      if (supported.includes("layout-shift")) {
        new PerformanceObserver((list) => {
          try {
            for (const e of list.getEntries() as any[]) {
              const v = Number(e.value);
              if (!Number.isFinite(v)) continue;
              const hadRecentInput = Boolean(e.hadRecentInput);
              if (hadRecentInput) continue;
              state.performanceSignals.cls = Number(state.performanceSignals.cls ?? 0) + v;
              maybeEmitPerf();
            }
          } catch {
            /* ignore */
          }
        }).observe({ type: "layout-shift", buffered: true } as any);
      }

      if (supported.includes("longtask")) {
        new PerformanceObserver((list) => {
          try {
            for (const e of list.getEntries() as any[]) {
              const d = Number(e.duration);
              if (!Number.isFinite(d)) continue;
              const cur = state.performanceSignals.longTasks ?? {};
              const nextCount = (cur.count ?? 0) + 1;
              const nextLongest = cur.longestMs != null ? Math.max(cur.longestMs ?? 0, d) : d;
              state.performanceSignals.longTasks = {
                count: nextCount,
                longestMs: nextLongest,
                lastAt: new Date().toISOString(),
              };
              maybeEmitPerf();
            }
          } catch {
            /* ignore */
          }
        }).observe({ type: "longtask", buffered: true } as any);
      }

      // INP best-effort: Performance Event Timing ('event') entry type.
      if (supported.includes("event")) {
        new PerformanceObserver((list) => {
          try {
            let maxDuration = state.performanceSignals.inpMs ?? 0;
            let updated = false;
            for (const e of list.getEntries() as any[]) {
              const d = Number(e.duration);
              if (!Number.isFinite(d)) continue;
              if (d > maxDuration) {
                maxDuration = d;
                updated = true;
              }
            }
            if (updated) {
              state.performanceSignals.inpMs = maxDuration;
              state.performanceSignals.inpAt = new Date().toISOString();
              maybeEmitPerf();
            }
          } catch {
            /* ignore */
          }
        }).observe({ type: "event", buffered: true } as any);
      }
    } catch {
      /* ignore */
    }
  }

  tryStartPerformanceObservers();

  const w = window;
  const origFetch = w.fetch.bind(w);
  w.fetch = async (...args: Parameters<typeof fetch>) => {
    const t0 = performance.now();
    const input = args[0];
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : "";
    let method =
      (typeof input !== "string" && input instanceof Request ? input.method : undefined) ||
      (args[1] && typeof args[1] === "object" && args[1] !== null && "method" in args[1]
        ? String((args[1] as RequestInit).method)
        : undefined) ||
      "GET";
    method = String(method).toUpperCase();

    try {
      const res = await origFetch(...args);
      const dt = Math.round(performance.now() - t0);
      const hdrs = readCorrelationHeadersFromResponse(res);
      pushNetworkEntry({
        at: new Date().toISOString(),
        method,
        url: rawUrl,
        status: res.status,
        durationMs: dt,
        statusText: res.statusText || "",
        requestId: hdrs.requestId,
        correlationId: hdrs.correlationId,
        contentType: hdrs.contentType,
      });
      return res;
    } catch (err) {
      const dt = Math.round(performance.now() - t0);
      const aborted = err instanceof Error && err.name === "AbortError";
      pushNetworkEntry({
        at: new Date().toISOString(),
        method,
        url: rawUrl,
        status: 0,
        durationMs: dt,
        aborted,
        statusText: aborted ? "aborted" : err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };

  const xhrMeta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    const urlStr = typeof url === "string" ? url : url.href;
    xhrMeta.set(this, { method: String(method).toUpperCase(), url: urlStr });
    origXhrOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
  };

  const origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = xhrMeta.get(this) ?? { method: "GET", url: "" };
    const t0 = performance.now();
    const onEnd = (): void => {
      this.removeEventListener("loadend", onEnd);
      const dt = Math.round(performance.now() - t0);
      let requestId: string | undefined;
      let correlationId: string | undefined;
      let contentType: string | undefined;
      const sameOrigin = requestUrlSameOriginAsPage(meta.url, location.href);
      const ct = safeXhrGetResponseHeader(this, "content-type");
      if (ct) contentType = ct.split(";")[0]?.trim();
      if (sameOrigin) {
        const rid =
          safeXhrGetResponseHeader(this, "x-request-id") ||
          safeXhrGetResponseHeader(this, "x-requestid");
        requestId = rid || undefined;
        const cid = safeXhrGetResponseHeader(this, "x-correlation-id");
        correlationId = cid || undefined;
      }
      pushNetworkEntry({
        at: new Date().toISOString(),
        method: meta.method,
        url: meta.url,
        status: this.status,
        durationMs: dt,
        statusText: this.statusText || "",
        requestId: requestId || undefined,
        correlationId: correlationId || undefined,
        contentType: contentType || undefined,
      });
    };
    this.addEventListener("loadend", onEnd);
    return origXhrSend.call(this, body);
  };

  document.addEventListener(
    "click",
    (ev) => {
      if (eventPathTouchesQaExtensionHost(ev)) return;
      const el = eventTargetElement(ev);
      if (!el) return;
      pushTimeline({ kind: "click", summary: `Clicou em ${summarizeClickTarget(el)}` });
    },
    true,
  );

  document.addEventListener(
    "submit",
    (ev) => {
      if (eventPathTouchesQaExtensionHost(ev)) return;
      const form = ev.target instanceof HTMLFormElement ? ev.target : null;
      if (!form) return;
      pushTimeline({ kind: "submit", summary: summarizeSubmitTarget(form) });
    },
    true,
  );

  document.addEventListener(
    "change",
    (ev) => {
      if (eventPathTouchesQaExtensionHost(ev)) return;
      const el = eventTargetElement(ev);
      if (!el || !(el instanceof HTMLElement)) return;
      if (
        !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
      )
        return;
      pushTimeline({ kind: "change", summary: summarizeFormFieldTimeline(el) });
    },
    true,
  );

  document.addEventListener(
    "input",
    (ev) => {
      if (eventPathTouchesQaExtensionHost(ev)) return;
      const el = eventTargetElement(ev);
      if (!el || !(el instanceof HTMLElement)) return;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (el instanceof HTMLInputElement) {
        const t = (el.type || "").toLowerCase();
        if (t === "checkbox" || t === "radio" || t === "file" || t === "hidden") return;
      }
      const key = fieldThrottleKey(el);
      const now = Date.now();
      const prev = lastInputAtByField.get(key) ?? 0;
      if (now - prev < CAPTURE_LIMITS.timelineInputThrottleMs) return;
      lastInputAtByField.set(key, now);
      if (lastInputAtByField.size > 200) {
        const iter = lastInputAtByField.keys();
        const first = iter.next().value as string | undefined;
        if (first) lastInputAtByField.delete(first);
      }
      pushTimeline({ kind: "input", summary: summarizeFormFieldTimeline(el) });
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (ev) => {
      if (eventPathTouchesQaExtensionHost(ev)) return;
      const sum = summarizeKeydownTimeline(ev.key);
      if (!sum) return;
      pushTimeline({ kind: "keydown", summary: sum });
    },
    true,
  );

  window.addEventListener("popstate", () => {
    try {
      const path = `${location.pathname}${location.search}`.slice(0, 200);
      pushTimeline({ kind: "navigate", summary: `Navegação (popstate) → ${path}` });
    } catch {
      /* ignore */
    }
  });

  type HistArgs = Parameters<History["pushState"]>;
  function patchHistory(method: "pushState" | "replaceState"): void {
    const orig = history[method].bind(history) as (...a: HistArgs) => void;
    (history as unknown as Record<string, (...a: HistArgs) => void>)[method] = (...args: HistArgs) => {
      const ret = orig(...args);
      try {
        const path = `${location.pathname}${location.search}`.slice(0, 200);
        pushTimeline({ kind: "navigate", summary: `SPA ${method} → ${path}` });
      } catch {
        /* ignore */
      }
      return ret;
    };
  }
  patchHistory("pushState");
  patchHistory("replaceState");

  let lastEmittedScrollY = typeof window.scrollY === "number" ? window.scrollY : 0;
  let lastScrollThrottleAt = 0;
  window.addEventListener(
    "scroll",
    () => {
      try {
        const now = Date.now();
        if (now - lastScrollThrottleAt < CAPTURE_LIMITS.timelineScrollThrottleMs) return;
        const y = window.scrollY ?? 0;
        const dy = Math.abs(y - lastEmittedScrollY);
        if (dy < CAPTURE_LIMITS.timelineScrollMinDeltaPx) return;
        lastScrollThrottleAt = now;
        const down = y >= lastEmittedScrollY;
        lastEmittedScrollY = y;
        const arrow = down ? "↓" : "↑";
        pushTimeline({
          kind: "scroll",
          summary: `Scroll ${arrow} ~${Math.round(dy)}px (eixo principal)`,
        });
      } catch {
        /* ignore */
      }
    },
    { passive: true },
  );

  let lastDialogSig = "";
  let lastTabSig = "";
  let domMutTimer: ReturnType<typeof setTimeout> | null = null;

  function flushDomTimelineHints(): void {
    try {
      const dSig = signatureDialogTitles(document);
      if (dSig !== lastDialogSig) {
        const prev = lastDialogSig;
        lastDialogSig = dSig;
        if (!dSig && prev) {
          pushTimeline({ kind: "dialog", summary: "Modal ou painel modal fechado" });
        } else if (dSig) {
          pushTimeline({
            kind: "dialog",
            summary: `Modal visível: ${dSig.replace(/\|/g, " · ").slice(0, 118)}`,
          });
        }
      }

      const tabLabel = summarizeTabSectionSelection(document);
      if (tabLabel && tabLabel !== lastTabSig) {
        lastTabSig = tabLabel;
        pushTimeline({ kind: "section", summary: `Aba ou secção ativa: ${tabLabel}` });
      }
    } catch {
      /* ignore */
    }
  }

  function scheduleDomTimelineHints(): void {
    if (domMutTimer != null) clearTimeout(domMutTimer);
    domMutTimer = setTimeout(() => {
      domMutTimer = null;
      flushDomTimelineHints();
    }, CAPTURE_LIMITS.timelineDomMutationDebounceMs);
  }

  try {
    const mo = new MutationObserver(() => scheduleDomTimelineHints());
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-selected", "aria-hidden", "aria-modal", "role", "open", "class"],
    });
  } catch {
    /* ignore */
  }

  emit();
}

init();
