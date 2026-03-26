/**
 * Imagens pendentes do modal (capturas/ficheiros) por aba — sobrevivem a navegações completas
 * porque o content script reinicia; o estado em memória (File + object URL) não.
 */
import { JIRA_FEEDBACK_MAX_IMAGES } from "./feedback-image-utils";

export type StoredPendingImageV1 = {
  id: string;
  fileName: string;
  mimeType: string;
  base64: string;
};

export type PendingImagesStoredPayloadV1 = {
  v: 1;
  images: StoredPendingImageV1[];
};

export function qafPendingImagesStorageKey(tabId: number): string {
  return `qafTabPendingImagesV1_${tabId}`;
}

export function parsePendingImagesFromStoredValue(raw: unknown): StoredPendingImageV1[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = o.images ?? (Array.isArray(raw) ? raw : null);
  if (!Array.isArray(arr)) return [];
  const out: StoredPendingImageV1[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.base64 !== "string") continue;
    const fn = typeof r.fileName === "string" ? r.fileName : "image.png";
    const mt = typeof r.mimeType === "string" ? r.mimeType : "image/png";
    if (typeof r.base64 !== "string" || r.base64.length === 0) continue;
    out.push({ id: r.id, fileName: fn, mimeType: mt, base64: r.base64 });
    if (out.length >= JIRA_FEEDBACK_MAX_IMAGES) break;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function loadPendingImagesFromExtensionTab(): Promise<StoredPendingImageV1[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const r = (await chrome.runtime.sendMessage({ type: "QAF_LOAD_PENDING_IMAGES" })) as {
        ok?: boolean;
        images?: StoredPendingImageV1[];
      };
      if (r?.ok === true && Array.isArray(r.images)) return r.images;
    } catch {
      /* SW a iniciar */
    }
    await sleep(50 * (attempt + 1));
  }
  return [];
}

export function persistPendingImagesToExtensionTab(images: StoredPendingImageV1[]): void {
  const payload: PendingImagesStoredPayloadV1 = { v: 1, images };
  try {
    void chrome.runtime.sendMessage({ type: "QAF_PERSIST_PENDING_IMAGES", payload });
  } catch {
    /* contexto invalidado */
  }
}

/** Reconstrói `File` + object URL para o estado do React. */
export function storedPendingImagesToUiState(
  stored: StoredPendingImageV1[],
): { id: string; file: File; url: string }[] {
  const out: { id: string; file: File; url: string }[] = [];
  for (const s of stored) {
    try {
      const binary = atob(s.base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], s.fileName, {
        type: s.mimeType || "image/png",
        lastModified: Date.now(),
      });
      out.push({ id: s.id, file, url: URL.createObjectURL(file) });
    } catch {
      /* base64 inválido */
    }
  }
  return out;
}
