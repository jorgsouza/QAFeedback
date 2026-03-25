/**
 * Roda no MAIN world (via <script src="chrome-extension://.../page-bridge.js">).
 * Evita CSP `script-src` contra inline; o host costuma permitir extensão em script-src.
 */
import { CAPTURE_LIMITS } from "../shared/context-limits";
import {
  eventPathTouchesQaExtensionHost,
  eventTargetElement,
  summarizeClickTarget,
  summarizeFormFieldTimeline,
  summarizeKeydownTimeline,
  summarizeSubmitTarget,
} from "../shared/interaction-timeline";
import { isBrowserExtensionSchemeUrl } from "../shared/network-summary";
import type { InteractionTimelineEntryV1, InteractionTimelineKindV1 } from "../shared/types";

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
  interactionTimeline: InteractionTimelineEntryV1[];
};

function cap<T>(arr: T[], n: number): T[] {
  return arr.slice(-n);
}

function readCorrelationHeadersFromResponse(res: Response): {
  requestId?: string;
  correlationId?: string;
  contentType?: string;
} {
  try {
    const requestId =
      res.headers.get("x-request-id") || res.headers.get("x-requestid") || res.headers.get("request-id") || undefined;
    const correlationId =
      res.headers.get("x-correlation-id") ||
      res.headers.get("correlation-id") ||
      res.headers.get("x-amzn-requestid") ||
      undefined;
    const ct = res.headers.get("content-type");
    const contentType = ct ? ct.split(";")[0]?.trim() : undefined;
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
  };

  const lastInputAtByField = new Map<string, number>();

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
      try {
        requestId = this.getResponseHeader("x-request-id") || this.getResponseHeader("x-requestid") || undefined;
        correlationId = this.getResponseHeader("x-correlation-id") || undefined;
        const ct = this.getResponseHeader("content-type");
        if (ct) contentType = ct.split(";")[0]?.trim();
      } catch {
        /* ignore */
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

  emit();
}

init();
