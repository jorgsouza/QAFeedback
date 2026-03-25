import { truncate } from "./sanitizer";
import { EXTENSION_ROOT_HOST_ID, eventPathTouchesExtensionUi } from "./extension-constants";

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
  if (tag === "a" && el instanceof HTMLAnchorElement) {
    const h = el.getAttribute("href") || "";
    const text = truncate((el.textContent || "").trim().replace(/\s+/g, " "), 50);
    const hrefT = truncate(h, 80);
    return text ? `link "${text}" (${hrefT})` : `link (${hrefT})`;
  }
  const testid = el.getAttribute("data-testid") || el.getAttribute("data-qa");
  if (testid) return `${tag}[data-testid="${truncate(testid, 80)}"]`;
  if (el.id) return `${tag}#${truncate(el.id, 60)}`;
  const text = truncate((el.textContent || "").trim().replace(/\s+/g, " "), 40);
  if (text) return `${tag} "${text}"`;
  return tag;
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
