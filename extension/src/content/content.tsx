import { createRoot } from "react-dom/client";
import { EXTENSION_ROOT_HOST_ID } from "../shared/extension-constants";
import { installInvalidatedExtensionContextGuards } from "../shared/extension-runtime";
import { FeedbackApp } from "../ui/FeedbackApp";

installInvalidatedExtensionContextGuards();

const HOST_ID = EXTENSION_ROOT_HOST_ID;

function mount(): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-qa-feedback-extension", "1");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const mountEl = document.createElement("div");
  shadow.appendChild(mountEl);
  createRoot(mountEl).render(<FeedbackApp />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mount(), { once: true });
} else {
  mount();
}
