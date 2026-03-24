import { EXTENSION_ROOT_HOST_ID } from "../shared/extension-constants";
import { safeImageFileNameForJira } from "../shared/feedback-image-utils";
import { cropDataUrlToPngBlob } from "../shared/region-screenshot-crop";
import { openRegionPickerOverlay } from "./region-picker-overlay";

function waitFrames(n: number): Promise<void> {
  return new Promise((r) => {
    const step = (k: number) => {
      if (k <= 0) r();
      else requestAnimationFrame(() => step(k - 1));
    };
    step(n);
  });
}

export type RegionScreenshotFlowResult =
  | { ok: true; file: File }
  | { ok: false; message: string };

/**
 * Esconde a UI da extensão, abre o seletor de região, captura o viewport visível e devolve um PNG recortado.
 */
export async function runRegionScreenshotFlow(): Promise<RegionScreenshotFlowResult> {
  const host = document.getElementById(EXTENSION_ROOT_HOST_ID) as HTMLElement | null;
  const prevDisplay = host?.style.display ?? "";
  const prevVisibility = host?.style.visibility ?? "";

  try {
    if (host) {
      host.style.visibility = "hidden";
      host.style.display = "none";
    }

    await waitFrames(2);

    const rect = await openRegionPickerOverlay();
    if (!rect) {
      return { ok: false, message: "Captura cancelada." };
    }

    await waitFrames(2);

    const cap = (await chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" })) as {
      ok?: boolean;
      dataUrl?: string;
      message?: string;
    };

    if (!cap?.ok || !cap.dataUrl) {
      return {
        ok: false,
        message: cap?.message ?? "Não foi possível capturar o separador (permissões ou página restrita).",
      };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const blob = await cropDataUrlToPngBlob(cap.dataUrl, rect, vw, vh);
    const file = new File([blob], safeImageFileNameForJira("captura-regiao.png"), {
      type: "image/png",
      lastModified: Date.now(),
    });

    return { ok: true, file };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Falha na captura por região.",
    };
  } finally {
    if (host) {
      host.style.display = prevDisplay;
      host.style.visibility = prevVisibility;
    }
  }
}
