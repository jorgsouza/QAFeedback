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
import type { InteractionTimelineEntryV1, InteractionTimelineKindV1 } from "../shared/types";

const SNAP_EVENT = "qa-feedback:snapshot";

function cap<T>(arr: T[], n: number): T[] {
  return arr.slice(-n);
}

type BridgeDetail = {
  console: { level: "error" | "warn" | "log"; message: string }[];
  failedRequests: { method: string; url: string; status: number; message: string }[];
  interactionTimeline: InteractionTimelineEntryV1[];
};

function init(): void {
  const root = document.documentElement;
  if (!root || root.getAttribute("data-qa-feedback-main-bridge") === "1") return;
  root.setAttribute("data-qa-feedback-main-bridge", "1");

  const state = {
    console: [] as { level: "error" | "warn" | "log"; message: string }[],
    failedRequests: [] as { method: string; url: string; status: number; message: string }[],
    timeline: [] as InteractionTimelineEntryV1[],
  };

  const lastInputAtByField = new Map<string, number>();

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
      failedRequests: cap(state.failedRequests, CAPTURE_LIMITS.bridgeFailedRequestsBuffer).slice(
        -CAPTURE_LIMITS.issueFailedRequests,
      ),
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
    const res = await origFetch(...args);
    try {
      if (!res.ok) {
        const input = args[0];
        const reqInit = args[1];
        const rawUrl = typeof input === "string" ? input : input instanceof Request ? input.url : "";
        const method =
          (typeof input !== "string" && input instanceof Request ? input.method : undefined) ||
          (reqInit && reqInit.method) ||
          "GET";
        state.failedRequests = cap(
          [
            ...state.failedRequests,
            {
              method: String(method).toUpperCase(),
              url: rawUrl,
              status: res.status,
              message: res.statusText || "",
            },
          ],
          CAPTURE_LIMITS.bridgeFailedRequestsBuffer,
        );
        emit();
      }
    } catch {
      /* ignore */
    }
    return res;
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
