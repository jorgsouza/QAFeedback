import type { ViewportRect } from "../shared/region-screenshot-crop";

const OVERLAY_ID = "qa-feedback-region-picker-overlay";
const MIN_W = 24;
const MIN_H = 24;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Overlay em página: arrastar para definir retângulo. Enter ou botão confirma; Esc cancela.
 */
export function openRegionPickerOverlay(): Promise<ViewportRect | null> {
  const existing = document.getElementById(OVERLAY_ID);
  existing?.remove();

  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.id = OVERLAY_ID;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Selecionar área para captura");
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      fontFamily: "system-ui, sans-serif",
      touchAction: "none",
    } as CSSStyleDeclaration);

    const dragSurface = document.createElement("div");
    dragSurface.setAttribute("data-qa-feedback", "region-drag");
    Object.assign(dragSurface.style, {
      position: "fixed",
      inset: "0",
      zIndex: "0",
      background: "rgba(0,0,0,0.38)",
      cursor: "crosshair",
      touchAction: "none",
    } as CSSStyleDeclaration);

    const bar = document.createElement("div");
    Object.assign(bar.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      padding: "12px 16px",
      background: "rgba(15, 23, 42, 0.92)",
      color: "#e2e8f0",
      fontSize: "13px",
      lineHeight: "1.45",
      zIndex: "2",
      boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
    } as CSSStyleDeclaration);
    bar.textContent =
      "Arraste na página para escolher a área. Enter ou «Capturar» confirma · Esc ou «Cancelar» cancela.";

    const actions = document.createElement("div");
    Object.assign(actions.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "12px",
      zIndex: "2",
    } as CSSStyleDeclaration);

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = "Cancelar";
    Object.assign(btnCancel.style, {
      padding: "10px 18px",
      borderRadius: "8px",
      border: "1px solid #64748b",
      background: "#1e293b",
      color: "#f1f5f9",
      fontWeight: "600",
      cursor: "pointer",
      fontSize: "14px",
    } as CSSStyleDeclaration);

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.textContent = "Capturar";
    Object.assign(btnOk.style, {
      padding: "10px 18px",
      borderRadius: "8px",
      border: "none",
      background: "#2563eb",
      color: "#fff",
      fontWeight: "600",
      cursor: "pointer",
      fontSize: "14px",
    } as CSSStyleDeclaration);

    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "fixed",
      display: "none",
      border: "2px solid #fff",
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
      pointerEvents: "none",
      zIndex: "1",
      boxSizing: "border-box",
    } as CSSStyleDeclaration);

    root.appendChild(dragSurface);
    root.appendChild(box);
    root.appendChild(bar);
    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);
    root.appendChild(actions);
    document.body.appendChild(root);

    let drag = false;
    let x0 = 0;
    let y0 = 0;
    let x1 = 0;
    let y1 = 0;

    const vw = () => window.innerWidth;
    const vh = () => window.innerHeight;

    function rectFromPoints(): ViewportRect {
      const l = clamp(Math.min(x0, x1), 0, vw());
      const t = clamp(Math.min(y0, y1), 0, vh());
      const r = clamp(Math.max(x0, x1), 0, vw());
      const b = clamp(Math.max(y0, y1), 0, vh());
      return { left: l, top: t, width: Math.max(0, r - l), height: Math.max(0, b - t) };
    }

    function paint() {
      const r = rectFromPoints();
      if (r.width < 2 || r.height < 2) {
        box.style.display = "none";
        return;
      }
      box.style.display = "block";
      box.style.left = `${r.left}px`;
      box.style.top = `${r.top}px`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
    }

    function cleanup(result: ViewportRect | null): void {
      root.remove();
      window.removeEventListener("keydown", onKey, true);
      resolve(result);
    }

    function confirm(): void {
      const r = rectFromPoints();
      if (r.width < MIN_W || r.height < MIN_H) {
        bar.textContent = `Área demasiado pequena (mín. ${MIN_W}×${MIN_H} px). Arraste outra vez.`;
        return;
      }
      cleanup(r);
    }

    function cancel(): void {
      cleanup(null);
    }

    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        confirm();
      }
    }

    window.addEventListener("keydown", onKey, true);

    btnCancel.addEventListener("click", () => cancel());
    btnOk.addEventListener("click", () => confirm());

    dragSurface.addEventListener("pointerdown", (e) => {
      drag = true;
      x0 = x1 = e.clientX;
      y0 = y1 = e.clientY;
      try {
        dragSurface.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      paint();
    });

    dragSurface.addEventListener("pointermove", (e) => {
      if (!drag) return;
      x1 = clamp(e.clientX, 0, vw());
      y1 = clamp(e.clientY, 0, vh());
      paint();
    });

    dragSurface.addEventListener("pointerup", (e) => {
      if (!drag) return;
      drag = false;
      try {
        dragSurface.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      x1 = clamp(e.clientX, 0, vw());
      y1 = clamp(e.clientY, 0, vh());
      paint();
    });

    dragSurface.addEventListener("pointercancel", () => {
      drag = false;
    });

    btnOk.focus();
  });
}
