/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  EXTENSION_REGION_PICKER_OVERLAY_ID,
  EXTENSION_ROOT_HOST_ID,
  elementIsInsideExtensionUi,
  eventPathTouchesExtensionUi,
} from "./extension-constants";

describe("extension UI detection", () => {
  it("treats region picker overlay descendants as extension UI", () => {
    const overlay = document.createElement("div");
    overlay.id = EXTENSION_REGION_PICKER_OVERLAY_ID;
    const btn = document.createElement("button");
    btn.textContent = "Capturar";
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
    try {
      expect(elementIsInsideExtensionUi(btn)).toBe(true);
      const ev = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(ev, "composedPath", {
        value: () => [btn, overlay, document.body, document.documentElement],
      });
      expect(eventPathTouchesExtensionUi(ev)).toBe(true);
    } finally {
      overlay.remove();
    }
  });

  it("detects shadow host in composed path", () => {
    const host = document.createElement("div");
    host.id = EXTENSION_ROOT_HOST_ID;
    const shadow = host.attachShadow({ mode: "open" });
    const inner = document.createElement("button");
    inner.textContent = "OK";
    shadow.appendChild(inner);
    document.body.appendChild(host);
    try {
      expect(elementIsInsideExtensionUi(inner)).toBe(true);
      const ev = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(ev, "composedPath", {
        value: () => [inner, shadow, host, document.body, document.documentElement],
      });
      expect(eventPathTouchesExtensionUi(ev)).toBe(true);
    } finally {
      host.remove();
    }
  });
});
