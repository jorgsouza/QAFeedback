/** Erro típico após recarregar a extensão sem dar F5 na página aberta. */
export function isExtensionContextInvalidatedError(e: unknown): boolean {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: unknown }).message)
        : typeof e === "string"
          ? e
          : "";
  return msg.includes("Extension context invalidated");
}

/**
 * `chrome.runtime.getURL` lança quando o content script ficou órfão (extensão recarregada).
 * Usar isto no content script evita `Uncaught` em `useMemo` / efeitos.
 */
export function tryGetExtensionResourceUrl(path: string): string | null {
  try {
    return chrome.runtime.getURL(path);
  } catch {
    return null;
  }
}

/** Evita que o Chrome mostre erro global por promises rejeitadas só com contexto invalidado. */
export function installInvalidatedExtensionContextGuards(): void {
  const swallow = (reason: unknown): boolean => isExtensionContextInvalidatedError(reason);

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    if (swallow(e.reason)) {
      e.preventDefault();
    }
  });

  window.addEventListener("error", (e: ErrorEvent) => {
    if (swallow(e.error)) {
      e.preventDefault();
    }
  });
}
