/** Host no DOM da página onde montamos o Shadow DOM da extensão. */
export const EXTENSION_ROOT_HOST_ID = "qa-feedback-extension-root";

/**
 * Overlay de «capturar área» (light DOM em `body`, fora do shadow host).
 * Deve ser ignorado na linha do tempo e no alvo do feedback como o host.
 */
export const EXTENSION_REGION_PICKER_OVERLAY_ID = "qa-feedback-region-picker-overlay";

function isExtensionOwnedTopElement(el: HTMLElement): boolean {
  return el.id === EXTENSION_ROOT_HOST_ID || el.id === EXTENSION_REGION_PICKER_OVERLAY_ID;
}

/** Clique/foco veio da UI da extensão (shadow host, overlay de região, ou shadow deles). */
export function eventPathTouchesExtensionUi(ev: Event): boolean {
  return ev.composedPath().some((n) => n instanceof HTMLElement && isExtensionOwnedTopElement(n));
}

/** Elemento pertence à UI da extensão (host, overlay de região, ou nós dentro do shadow do host). */
export function elementIsInsideExtensionUi(el: Element | null): boolean {
  if (!el) return false;
  try {
    if (el.closest(`#${EXTENSION_REGION_PICKER_OVERLAY_ID}`)) return true;
  } catch {
    /* invalid selector edge cases */
  }
  if (el.id === EXTENSION_ROOT_HOST_ID) return true;
  const root = el.getRootNode();
  return (
    root instanceof ShadowRoot &&
    root.host instanceof HTMLElement &&
    root.host.id === EXTENSION_ROOT_HOST_ID
  );
}
