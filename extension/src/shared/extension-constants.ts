/** Host no DOM da página onde montamos o Shadow DOM da extensão. */
export const EXTENSION_ROOT_HOST_ID = "qa-feedback-extension-root";

/** Clique/foco veio da UI da extensão (inclui o que está dentro do shadow). */
export function eventPathTouchesExtensionUi(ev: Event): boolean {
  return ev.composedPath().some((n) => n instanceof HTMLElement && n.id === EXTENSION_ROOT_HOST_ID);
}

/** Elemento pertence à UI da extensão (host ou nós dentro do shadow dele). */
export function elementIsInsideExtensionUi(el: Element | null): boolean {
  if (!el) return false;
  if (el.id === EXTENSION_ROOT_HOST_ID) return true;
  const root = el.getRootNode();
  return (
    root instanceof ShadowRoot &&
    root.host instanceof HTMLElement &&
    root.host.id === EXTENSION_ROOT_HOST_ID
  );
}
