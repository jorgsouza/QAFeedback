import { truncate } from "./sanitizer";
import {
  EXTENSION_ROOT_HOST_ID,
  elementIsInsideExtensionUi,
  eventPathTouchesExtensionUi,
} from "./extension-constants";

/** Alinhado a `EXTENSION_ROOT_HOST_ID` — usado no page-bridge (bundle separado). */
export const TIMELINE_IGNORE_HOST_ID = EXTENSION_ROOT_HOST_ID;

/** Mesma regra que `eventPathTouchesExtensionUi` (host + overlay de região). */
export function eventPathTouchesQaExtensionHost(ev: Event): boolean {
  return eventPathTouchesExtensionUi(ev);
}

export function eventTargetElement(ev: Event): Element | null {
  const t = ev.target;
  if (t instanceof Element) return t;
  if (t instanceof Text && t.parentElement) return t.parentElement;
  return null;
}

const SENSITIVE_FIELD = /(password|pass|token|secret|cpf|creditcard|cardnumber|cvv|cvc|senha|ssn)/i;

export function summarizeFormFieldTimeline(el: HTMLElement): string {
  if (el instanceof HTMLSelectElement) {
    const label = el.name || el.id || "select";
    return `Lista "${truncate(label.replace(/\s+/g, " ").trim(), 60)}" alterada`;
  }
  if (el instanceof HTMLTextAreaElement) {
    const label = el.name || el.id || "textarea";
    return `Campo de texto "${truncate(label.replace(/\s+/g, " ").trim(), 60)}" alterado`;
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.type || "text").toLowerCase();
    const name = el.name || "";
    const id = el.id || "";
    const label = name || id || type;
    if (type === "password" || type === "hidden") return `Campo sensível (${type}) alterado`;
    if (SENSITIVE_FIELD.test(name) || SENSITIVE_FIELD.test(id))
      return `Campo sensível (${truncate(label, 40)}) alterado`;
    if (type === "checkbox" || type === "radio")
      return `${type === "checkbox" ? "Checkbox" : "Radio"} "${truncate(label, 50)}" ${el.checked ? "marcado" : "desmarcado"}`;
    return `Campo "${truncate(label, 60)}" alterado`;
  }
  return `Campo ${el.tagName.toLowerCase()} alterado`;
}

export function summarizeClickTarget(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  const aria = el.getAttribute("aria-label")?.trim();
  const testid = el.getAttribute("data-testid") || el.getAttribute("data-qa");

  if (role === "tab") {
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    const label = truncate(aria || text || el.id || "aba", 55);
    return `aba "${label}"`;
  }

  if (tag === "a" && el instanceof HTMLAnchorElement) {
    const h = el.getAttribute("href") || "";
    const text = truncate((el.textContent || "").trim().replace(/\s+/g, " "), 50);
    const hrefT = truncate(h, 80);
    return text ? `link "${text}" (${hrefT})` : `link (${hrefT})`;
  }

  if (testid) return `${tag}[data-testid="${truncate(testid, 80)}"]`;
  if (el.id) return `${tag}#${truncate(el.id, 60)}`;
  if (aria) return `${tag} (aria-label: "${truncate(aria, 72)}")`;
  const text = truncate((el.textContent || "").trim().replace(/\s+/g, " "), 40);
  if (text) return `${tag} "${text}"`;
  return tag;
}

/** Rótulo da aba/secção ativa (best-effort). */
export function summarizeTabSectionSelection(doc: Document): string {
  const tab = doc.querySelector('[role="tab"][aria-selected="true"]');
  if (!(tab instanceof Element)) return "";
  if (elementIsInsideExtensionUi(tab)) return "";
  const aria = tab.getAttribute("aria-label")?.trim();
  const text = (tab.textContent || "").trim().replace(/\s+/g, " ");
  const id = tab.id ? `#${tab.id}` : "";
  const raw = aria || text || id;
  if (!raw) return "";
  return truncate(raw, 72);
}

/**
 * Assinatura estável dos modais visíveis (títulos truncados, até 3), para comparar mudanças.
 */
export function signatureDialogTitles(doc: Document): string {
  const selectors = [
    '[role="dialog"][aria-modal="true"]',
    '[aria-modal="true"]',
    '[role="alertdialog"]',
  ].join(",");
  const nodes = Array.from(doc.querySelectorAll(selectors));
  const parts: string[] = [];
  for (const n of nodes) {
    if (!(n instanceof Element)) continue;
    /** Não registar modais do overlay de captura nem da UI da extensão na timeline da página. */
    if (elementIsInsideExtensionUi(n)) continue;
    const aria = n.getAttribute("aria-label")?.trim();
    const labelled = n.getAttribute("aria-labelledby");
    let fromLabelled = "";
    if (!aria && labelled) {
      const id = labelled.split(/\s+/)[0]?.trim();
      const ref = id ? doc.getElementById(id) : null;
      if (ref) fromLabelled = (ref.textContent || "").trim().replace(/\s+/g, " ");
    }
    const fallback = (n.textContent || "").trim().replace(/\s+/g, " ").slice(0, 72);
    const piece = truncate(aria || fromLabelled || fallback || n.tagName.toLowerCase(), 65);
    if (piece) parts.push(piece);
    if (parts.length >= 3) break;
  }
  return parts.join("|");
}

export function summarizeSubmitTarget(form: HTMLFormElement): string {
  const id = form.id ? `#${truncate(form.id, 40)}` : "";
  const action = form.getAttribute("action");
  const act = action ? truncate(action, 60) : "";
  return `Envio de formulário${id}${act ? ` → ${act}` : ""}`;
}

export function summarizeKeydownTimeline(key: string): string | null {
  if (key === "Enter") return "Tecla Enter";
  if (key === "Tab") return "Tecla Tab";
  if (key === "Escape") return "Tecla Escape";
  return null;
}
