/**
 * Roda no MAIN world (via <script src="chrome-extension://.../page-bridge.js">).
 * Evita CSP `script-src` contra inline; o host costuma permitir extensão em script-src.
 */
import { CAPTURE_LIMITS } from "../shared/context-limits";

const SNAP_EVENT = "qa-feedback:snapshot";

function cap<T>(arr: T[], n: number): T[] {
  return arr.slice(-n);
}

function init(): void {
  const root = document.documentElement;
  if (!root || root.getAttribute("data-qa-feedback-main-bridge") === "1") return;
  root.setAttribute("data-qa-feedback-main-bridge", "1");

  const state = {
    console: [] as { level: "error" | "warn" | "log"; message: string }[],
    failedRequests: [] as { method: string; url: string; status: number; message: string }[],
  };

  function emit(): void {
    const detail = {
      console: cap(state.console, CAPTURE_LIMITS.bridgeConsoleBuffer).slice(
        -CAPTURE_LIMITS.issueConsoleEntries,
      ),
      failedRequests: cap(state.failedRequests, CAPTURE_LIMITS.bridgeFailedRequestsBuffer).slice(
        -CAPTURE_LIMITS.issueFailedRequests,
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

  emit();
}

init();
