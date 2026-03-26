/**
 * Estado do painel + rascunho na aba.
 * - sessionStorage: rápido; sites podem limpar ou corromper.
 * - chrome.storage.session (SW, por tabId): cópia da extensão; leitura com retry (SW a dormir).
 */
import type { IssueFormState } from "./types";

const STORAGE_KEY = "__qafFeedbackUiV1";

const DRAFT_FIELD_MAX = 8000;

export type FeedbackTabSnapshotV2 = {
  v: 2;
  open: boolean;
  sheetCollapsed: boolean;
  minimized: boolean;
  repoIndex?: number;
  selectedJiraBoardId?: string;
  panelTab?: "form" | "preview";
  title?: string;
  whatHappened?: string;
  includeTechnicalContext?: boolean;
  sendToGitHub?: boolean;
  sendToJira?: boolean;
  jiraMotivoAbertura?: string;
};

export type QafLoadTabUiResponse = {
  ok: true;
  state: FeedbackTabSnapshotV2 | null;
};

function trimDraftField(s: string): string {
  if (s.length <= DRAFT_FIELD_MAX) return s;
  return s.slice(0, DRAFT_FIELD_MAX);
}

/** Usado também no service worker para normalizar o que está em storage. */
export function parseTabSnapshotFromStoredValue(raw: unknown): FeedbackTabSnapshotV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v === 1) {
    return {
      v: 2,
      open: Boolean(o.open),
      sheetCollapsed: Boolean(o.sheetCollapsed),
      minimized: Boolean(o.minimized),
    };
  }
  if (o.v !== 2) return null;
  const panelTab = o.panelTab === "preview" || o.panelTab === "form" ? o.panelTab : undefined;
  const ri = o.repoIndex;
  return {
    v: 2,
    open: Boolean(o.open),
    sheetCollapsed: Boolean(o.sheetCollapsed),
    minimized: Boolean(o.minimized),
    repoIndex: typeof ri === "number" && Number.isFinite(ri) ? ri : undefined,
    selectedJiraBoardId: typeof o.selectedJiraBoardId === "string" ? o.selectedJiraBoardId : undefined,
    panelTab,
    title: typeof o.title === "string" ? trimDraftField(o.title) : undefined,
    whatHappened: typeof o.whatHappened === "string" ? trimDraftField(o.whatHappened) : undefined,
    includeTechnicalContext:
      typeof o.includeTechnicalContext === "boolean" ? o.includeTechnicalContext : undefined,
    sendToGitHub: typeof o.sendToGitHub === "boolean" ? o.sendToGitHub : undefined,
    sendToJira: typeof o.sendToJira === "boolean" ? o.sendToJira : undefined,
    jiraMotivoAbertura: typeof o.jiraMotivoAbertura === "string" ? o.jiraMotivoAbertura : undefined,
  };
}

export function readTabSnapshotFromSession(): FeedbackTabSnapshotV2 | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseTabSnapshotFromStoredValue(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeTabSnapshotToSession(s: FeedbackTabSnapshotV2): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota / privado */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function loadTabSnapshotFromExtensionTab(): Promise<FeedbackTabSnapshotV2 | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const r = (await chrome.runtime.sendMessage({ type: "QAF_LOAD_TAB_UI" })) as
        | QafLoadTabUiResponse
        | { ok?: false };
      if (r && r.ok === true) return r.state;
    } catch {
      /* SW a iniciar */
    }
    await sleep(50 * (attempt + 1));
  }
  return null;
}

export function persistTabSnapshotToExtensionTab(s: FeedbackTabSnapshotV2): void {
  try {
    void chrome.runtime.sendMessage({ type: "QAF_PERSIST_TAB_UI", payload: s });
  } catch {
    /* contexto invalidado */
  }
}

/** Montagem do objeto a gravar (corta textos longos). */
export function buildTabSnapshotV2(params: {
  open: boolean;
  sheetCollapsed: boolean;
  repoIndex: number;
  selectedJiraBoardId: string;
  panelTab: "form" | "preview";
  form: IssueFormState;
}): FeedbackTabSnapshotV2 {
  const { form, ...rest } = params;
  return {
    v: 2,
    open: rest.open,
    sheetCollapsed: rest.sheetCollapsed,
    minimized: false,
    repoIndex: rest.repoIndex,
    selectedJiraBoardId: rest.selectedJiraBoardId.trim() || undefined,
    panelTab: rest.panelTab,
    title: trimDraftField(form.title),
    whatHappened: trimDraftField(form.whatHappened),
    includeTechnicalContext: form.includeTechnicalContext,
    sendToGitHub: form.sendToGitHub,
    sendToJira: form.sendToJira,
    jiraMotivoAbertura: form.jiraMotivoAbertura || undefined,
  };
}
