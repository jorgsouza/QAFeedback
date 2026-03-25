import { createRoot, type Root } from "react-dom/client";
import { EXTENSION_ROOT_HOST_ID } from "../shared/extension-constants";
import { installInvalidatedExtensionContextGuards } from "../shared/extension-runtime";
import { subscribeToLocationChanges } from "../shared/location-subscription";
import { FeedbackApp } from "../ui/FeedbackApp";

const HOST_ID = EXTENSION_ROOT_HOST_ID;

type WindowWithQaf = Window & { __qafContentScriptV1?: true };

let appRoot: Root | null = null;

function mountParent(): HTMLElement | null {
  return document.documentElement ?? document.body;
}

function mount(): void {
  const existing = document.getElementById(HOST_ID);
  if (existing?.isConnected) return;

  if (appRoot) {
    try {
      appRoot.unmount();
    } catch {
      /* host removed from DOM without unmount */
    }
    appRoot = null;
  }
  existing?.remove();

  const parent = mountParent();
  if (!parent) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-qa-feedback-extension", "1");
  parent.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const mountEl = document.createElement("div");
  shadow.appendChild(mountEl);
  appRoot = createRoot(mountEl);
  appRoot.render(<FeedbackApp />);
}

let ensureRaf = 0;
function scheduleEnsureHostMounted(): void {
  if (ensureRaf) return;
  ensureRaf = requestAnimationFrame(() => {
    ensureRaf = 0;
    mount();
  });
}

function initHostPersistence(): void {
  subscribeToLocationChanges(scheduleEnsureHostMounted);

  const html = document.documentElement;
  if (html) {
    const observer = new MutationObserver(() => {
      scheduleEnsureHostMounted();
    });
    observer.observe(html, { childList: true, subtree: false });
  }
}

function start(): void {
  installInvalidatedExtensionContextGuards();
  mount();
  initHostPersistence();
}

const win = window as WindowWithQaf;
if (win.__qafContentScriptV1) {
  scheduleEnsureHostMounted();
} else {
  win.__qafContentScriptV1 = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => start(), { once: true });
  } else {
    start();
  }
}
