/**
 * Notifica quando a URL do documento muda sem reload (SPA) ou após navegação clássica.
 * Usa popstate, hashchange, patch idempotente de history.pushState/replaceState, pageshow (BFCache) e visibilitychange.
 */

const HISTORY_PATCHED = new WeakMap<History, true>();

function dispatchLocationChange(): void {
  window.dispatchEvent(new Event("qaf:locationchange"));
}

export function subscribeToLocationChanges(onChange: () => void): () => void {
  const notify = () => {
    onChange();
  };

  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  window.addEventListener("qaf:locationchange", notify);

  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) notify();
  };
  window.addEventListener("pageshow", onPageShow);

  const onVisibility = () => {
    if (document.visibilityState === "visible") notify();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const h = window.history;
  if (!HISTORY_PATCHED.has(h)) {
    HISTORY_PATCHED.set(h, true);
    const push = h.pushState.bind(h);
    const replace = h.replaceState.bind(h);
    h.pushState = ((...args: Parameters<History["pushState"]>) => {
      push(...args);
      dispatchLocationChange();
    }) as History["pushState"];
    h.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      replace(...args);
      dispatchLocationChange();
    }) as History["replaceState"];
  }

  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("qaf:locationchange", notify);
    window.removeEventListener("pageshow", onPageShow);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
