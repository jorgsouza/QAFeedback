import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { normalizeCaptureMode } from "../shared/capture-mode";
import type {
  CaptureModeV1,
  CreateIssuePayload,
  InteractionTimelineEntryV1,
  IssueFormState,
  JiraImageAttachmentPayload,
} from "../shared/types";
import {
  fileToBase64,
  JIRA_FEEDBACK_MAX_IMAGE_BYTES,
  JIRA_FEEDBACK_MAX_IMAGES,
  safeImageFileNameForJira,
} from "../shared/feedback-image-utils";
import {
  loadPendingImagesFromExtensionTab,
  persistPendingImagesToExtensionTab,
  storedPendingImagesToUiState,
  type StoredPendingImageV1,
} from "../shared/pending-images-session";
import { pickSpeechRecognitionLang } from "../shared/chrome-speech-dictation";
import { detectDictationPlatform, getDictationMicTooltip } from "../shared/native-dictation-hint";
import { buildIssueBody } from "../shared/issue-builder";
import {
  buildCapturedIssueContext,
  ensurePageBridgeInjected,
  fetchSessionTimelineForSubmit,
  readBridgeSnapshot,
} from "../shared/context-collector";
import { subscribeToLocationChanges } from "../shared/location-subscription";
import { resolvePageRouteInfo } from "../shared/page-route-context";
import { shadowCss } from "./shadow-styles";
import {
  elementIsInsideExtensionUi,
  eventPathTouchesExtensionUi,
  QAF_ENGAGE_EXTENSION_UI_EVENT,
} from "../shared/extension-constants";
import {
  isExtensionContextInvalidatedError,
  tryGetExtensionResourceUrl,
} from "../shared/extension-runtime";
import { JIRA_MOTIVO_ABERTURA_OPTIONS, isJiraMotivoAbertura } from "../shared/jira-motivo";
import {
  buildTabSnapshotV2,
  loadTabSnapshotFromExtensionTab,
  persistTabSnapshotToExtensionTab,
  readTabSnapshotFromSession,
  writeTabSnapshotToSession,
} from "../shared/feedback-ui-session";
import { useChromeSpeechDictation } from "./useChromeSpeechDictation";
import { runRegionScreenshotFlow } from "../content/region-screenshot-flow";

type Tab = "form" | "preview";

type RepoOption = { owner: string; repo: string; label: string };
type JiraBoardOption = { id: number; name: string; type?: string };

function HeaderCollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden focusable="false">
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        d="M8.5 5v14"
      />
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.25 8.25L12.5 12l3.75 3.75"
      />
    </svg>
  );
}

function HeaderSettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden focusable="false">
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

type PendingFeedbackImage = { id: string; file: File; url: string };

const FEEDBACK_ICON_URL = tryGetExtensionResourceUrl("qa.png");
const CHECK_POSITIVO_URL = tryGetExtensionResourceUrl("check_positivo.svg");
const JIRA_BOARD_ICON_URL = tryGetExtensionResourceUrl("jiraBoard.svg");
const JIRA_ISSUE_ICON_URL = tryGetExtensionResourceUrl("jiraIssue.svg");

function CopyIcon() {
  return (
    <svg className="qaf-dictation-mic-svg" viewBox="0 0 24 24" width={16} height={16} aria-hidden>
      <path
        fill="currentColor"
        d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
      />
    </svg>
  );
}

/** Figma body_sucess / cards — ícone 24×24 ao lado do rótulo. */
function LayoutDashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M4 4h7v7H4V4zm9 0h7v4h-7V4zm0 6h7v10h-7V10zM4 13h7v7H4v-7z"
      />
    </svg>
  );
}

function TaskIssueIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"
      />
    </svg>
  );
}

function GitHubMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} aria-hidden focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

function SuccessCheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={40} height={40} aria-hidden focusable="false">
      <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

/** Ilustração {DS} (Figma); fallback ao glifo inline se o asset não existir. */
function SuccessCheckIllustration() {
  if (CHECK_POSITIVO_URL) {
    return (
      <img
        src={CHECK_POSITIVO_URL}
        alt=""
        width={80}
        height={80}
        className="qaf-success-check-img"
        draggable={false}
      />
    );
  }
  return <SuccessCheckGlyph />;
}

/** Ícones 24×24 {DS}-Icons (Figma); fallback aos SVGs inline. */
function JiraBoardCardIcon() {
  if (JIRA_BOARD_ICON_URL) {
    return (
      <img
        src={JIRA_BOARD_ICON_URL}
        alt=""
        width={24}
        height={24}
        className="qaf-ds-icon-img"
        draggable={false}
      />
    );
  }
  return <LayoutDashboardIcon />;
}

function JiraIssueCardIcon() {
  if (JIRA_ISSUE_ICON_URL) {
    return (
      <img
        src={JIRA_ISSUE_ICON_URL}
        alt=""
        width={24}
        height={24}
        className="qaf-ds-icon-img"
        draggable={false}
      />
    );
  }
  return <TaskIssueIcon />;
}

/**
 * Microfone estilo {DS} Icons / Figma (outline). SVG embutido: o ficheiro mic.png anterior era texto (URL), não PNG.
 */
function MicIcon() {
  return (
    <svg
      className="qaf-dictation-mic-svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 10v2a7 7 0 0 1-14 0v-2"
      />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 19v3" />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M8 22h8" />
    </svg>
  );
}

/** Ícone do FAB: `public/qa.png` 64×64; botão icon-only 64×64 (Figma). */
function FeedbackFabIcon() {
  if (!FEEDBACK_ICON_URL) {
    return (
      <span className="qaf-fab-icon-wrap qaf-fab-fallback" aria-hidden>
        QA
      </span>
    );
  }
  return (
    <span className="qaf-fab-icon-wrap">
      <img src={FEEDBACK_ICON_URL} alt="" draggable={false} />
    </span>
  );
}

function destinationDefaults(githubOk: boolean, jiraOk: boolean): IssueFormState {
  const base = {
    title: "",
    whatHappened: "",
    includeTechnicalContext: true,
    jiraMotivoAbertura: "",
  };
  if (!githubOk && !jiraOk) return { ...base, sendToGitHub: false, sendToJira: false };
  if (githubOk && !jiraOk) return { ...base, sendToGitHub: true, sendToJira: false };
  if (!githubOk && jiraOk) return { ...base, sendToGitHub: false, sendToJira: true };
  return { ...base, sendToGitHub: true, sendToJira: false };
}

const initialForm = (): IssueFormState => destinationDefaults(false, false);

function readInitialUiState(): { sheetCollapsed: boolean; open: boolean; fabDismissed: boolean } {
  const s = readTabSnapshotFromSession();
  if (!s) return { sheetCollapsed: false, open: false, fabDismissed: false };
  return {
    sheetCollapsed: s.sheetCollapsed,
    open: s.open,
    fabDismissed: Boolean(s.fabDismissed),
  };
}

function initialFormFromSnapshot(): IssueFormState {
  const s = readTabSnapshotFromSession();
  const base = initialForm();
  if (!s) return base;
  return {
    ...base,
    title: s.title ?? base.title,
    whatHappened: s.whatHappened ?? base.whatHappened,
    includeTechnicalContext: s.includeTechnicalContext ?? base.includeTechnicalContext,
    sendToGitHub: s.sendToGitHub ?? base.sendToGitHub,
    sendToJira: s.sendToJira ?? base.sendToJira,
    jiraMotivoAbertura: s.jiraMotivoAbertura ?? base.jiraMotivoAbertura,
  };
}

export function FeedbackApp() {
  const [initialUi] = useState(readInitialUiState);
  /** Painel tipo sheet recolhido: formulário mantém-se; FAB reabre. */
  const [sheetCollapsed, setSheetCollapsed] = useState(initialUi.sheetCollapsed);
  const [open, setOpen] = useState(initialUi.open);
  const openRef = useRef(initialUi.open);
  openRef.current = open;
  const integrationsLoadGenRef = useRef(0);
  /** Evita aviso falso de “sem destino” enquanto LIST_REPO_TARGETS não termina (ex.: após F5). */
  const [integrationsFetchState, setIntegrationsFetchState] = useState<"idle" | "loading" | "done">(
    () => (initialUi.open ? "loading" : "idle"),
  );
  const [fabDismissed, setFabDismissed] = useState(initialUi.fabDismissed);
  const [tab, setTab] = useState<Tab>(() => {
    const p = readTabSnapshotFromSession()?.panelTab;
    return p === "preview" ? "preview" : "form";
  });
  const [form, setForm] = useState<IssueFormState>(initialFormFromSnapshot);
  const [lastTarget, setLastTarget] = useState<Element | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postSubmit, setPostSubmit] = useState<{
    github?: string;
    jira?: string;
    /** Só quando `jira` aponta ao quadro: link /browse/KEY */
    jiraIssueBrowse?: string;
    /** ID numérico do quadro Jira usado na criação (validado no service worker). */
    jiraBoardIdUsed?: string;
    warnings?: string[];
  } | null>(null);
  const [repoTargets, setRepoTargets] = useState<RepoOption[]>([]);
  const [repoIndex, setRepoIndex] = useState(() => {
    const ri = readTabSnapshotFromSession()?.repoIndex;
    return ri != null && ri >= 0 ? ri : 0;
  });
  /** Tokens guardados nas opções: controlam destinos visíveis no modal. */
  const [githubTokenConfigured, setGithubTokenConfigured] = useState(false);
  const [jiraTokenConfigured, setJiraTokenConfigured] = useState(false);
  /** null = OK; context = extensão recarregada — precisa F5; other = falha de mensagem; loadFailed = erro no SW ao ler storage */
  const [repoListIssue, setRepoListIssue] = useState<null | "context" | "other" | "loadFailed">(null);
  const [jiraBoardsForModal, setJiraBoardsForModal] = useState<JiraBoardOption[]>([]);
  const [selectedJiraBoardId, setSelectedJiraBoardId] = useState(
    () => readTabSnapshotFromSession()?.selectedJiraBoardId ?? "",
  );
  const [jiraBoardsListError, setJiraBoardsListError] = useState<string | null>(null);
  /** Opção nas definições: captura HAR com o modal aberto. */
  const [fullNetworkDiagnosticEnabled, setFullNetworkDiagnosticEnabled] = useState(false);
  /** PRD-011 Fase 2 — modo de contexto na issue (vem das opções). */
  const [captureMode, setCaptureMode] = useState<CaptureModeV1>("debug-interno");
  const [networkDiagError, setNetworkDiagError] = useState<string | null>(null);
  const [regionScreenshotBusy, setRegionScreenshotBusy] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingFeedbackImage[]>([]);
  /** Timeline acumulada no SW (multi-URL); atualizada para o separador Preview. */
  const [sessionTimelinePreview, setSessionTimelinePreview] = useState<InteractionTimelineEntryV1[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const whatTextareaRef = useRef<HTMLTextAreaElement>(null);

  const dictationPlatform = useMemo(() => detectDictationPlatform(), []);
  const speechRecognitionLang = useMemo(() => pickSpeechRecognitionLang(), []);

  const getFormSnapshot = useCallback(() => form, [form]);
  const {
    listeningField,
    speechSupported,
    secureContext,
    toggleField,
    speechError,
    clearSpeechError,
  } = useChromeSpeechDictation(setForm, getFormSnapshot, { enabled: open && !sheetCollapsed });

  useEffect(() => {
    ensurePageBridgeInjected();
  }, []);

  /** Regista sessão de timeline por aba (não limpa histórico já agregado no SW). */
  useEffect(() => {
    if (!open) return;
    void chrome.runtime
      .sendMessage({
        type: "QAF_TIMELINE_SESSION_START",
        sessionId: crypto.randomUUID(),
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    const onEngage = () => setFabDismissed(false);
    window.addEventListener(QAF_ENGAGE_EXTENSION_UI_EVENT, onEngage);
    return () => window.removeEventListener(QAF_ENGAGE_EXTENSION_UI_EVENT, onEngage);
  }, []);

  /** Evita gravar `open: false` na extensão antes de ler `chrome.storage.session` (corrida ao trocar de URL). */
  const [tabUiHydrated, setTabUiHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [fromExt, pendingStored] = await Promise.all([
          loadTabSnapshotFromExtensionTab(),
          loadPendingImagesFromExtensionTab(),
        ]);
        if (cancelled) return;
        if (pendingStored.length > 0) {
          setPendingImages(storedPendingImagesToUiState(pendingStored));
        }
        if (fromExt) {
          const sess = readTabSnapshotFromSession();
          if (fromExt.open && (!sess || !sess.open)) {
            setOpen(true);
            setSheetCollapsed(fromExt.sheetCollapsed);
          } else if (!sess) {
            setOpen(fromExt.open);
            setSheetCollapsed(fromExt.sheetCollapsed);
          }
          const sessDraftEmpty =
            !sess || (!(sess.title ?? "").trim() && !(sess.whatHappened ?? "").trim());
          const extHasDraft =
            (fromExt.title != null && fromExt.title.length > 0) ||
            (fromExt.whatHappened != null && fromExt.whatHappened.length > 0);
          if (extHasDraft && sessDraftEmpty) {
            setForm((f) => ({
              ...f,
              title: fromExt.title ?? f.title,
              whatHappened: fromExt.whatHappened ?? f.whatHappened,
              includeTechnicalContext: fromExt.includeTechnicalContext ?? f.includeTechnicalContext,
              sendToGitHub: fromExt.sendToGitHub ?? f.sendToGitHub,
              sendToJira: fromExt.sendToJira ?? f.sendToJira,
              jiraMotivoAbertura: fromExt.jiraMotivoAbertura ?? f.jiraMotivoAbertura,
            }));
          }
          if (!sess) {
            setFabDismissed(Boolean(fromExt.fabDismissed));
            if (fromExt.repoIndex != null && Number.isFinite(fromExt.repoIndex) && fromExt.repoIndex >= 0) {
              setRepoIndex(fromExt.repoIndex);
            }
            if (fromExt.selectedJiraBoardId) setSelectedJiraBoardId(fromExt.selectedJiraBoardId);
            if (fromExt.panelTab === "preview" || fromExt.panelTab === "form") setTab(fromExt.panelTab);
          }
        }
      } finally {
        if (!cancelled) setTabUiHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!tabUiHydrated) return;
    const snap = buildTabSnapshotV2({
      open,
      sheetCollapsed,
      repoIndex,
      selectedJiraBoardId,
      panelTab: tab,
      form,
      fabDismissed,
    });
    const h = window.setTimeout(() => {
      writeTabSnapshotToSession(snap);
      persistTabSnapshotToExtensionTab(snap);
    }, 250);
    return () => clearTimeout(h);
  }, [open, sheetCollapsed, repoIndex, selectedJiraBoardId, tab, form, fabDismissed, tabUiHydrated]);

  /** Mantém capturas/ficheiros após navegação completa (content script reinicia). */
  useEffect(() => {
    if (!tabUiHydrated) return;
    const h = window.setTimeout(() => {
      void (async () => {
        const stored: StoredPendingImageV1[] = [];
        for (const im of pendingImages) {
          if (im.file.size > JIRA_FEEDBACK_MAX_IMAGE_BYTES) continue;
          try {
            const base64 = await fileToBase64(im.file);
            stored.push({
              id: im.id,
              fileName: safeImageFileNameForJira(im.file.name),
              mimeType: im.file.type || "image/png",
              base64,
            });
          } catch {
            /* ficheiro ilegível */
          }
        }
        persistPendingImagesToExtensionTab(stored);
      })();
    }, 450);
    return () => window.clearTimeout(h);
  }, [pendingImages, tabUiHydrated]);

  const [routeRevision, setRouteRevision] = useState(0);
  useEffect(() => subscribeToLocationChanges(() => setRouteRevision((n) => n + 1)), []);

  useEffect(() => {
    if (!open || !form.includeTechnicalContext) {
      setSessionTimelinePreview([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const entries = await fetchSessionTimelineForSubmit();
        if (!cancelled) setSessionTimelinePreview(entries);
      } catch {
        if (!cancelled) setSessionTimelinePreview([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form.includeTechnicalContext, routeRevision, tab, postSubmit]);

  useEffect(() => {
    if (open) clearSpeechError();
  }, [open, clearSpeechError]);

  const addImageFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(
      (f) =>
        f.type.startsWith("image/") ||
        (!(f.type ?? "").trim() && /\.(png|apng|jpe?g|gif|webp|bmp)$/i.test(f.name)),
    );
    setPendingImages((prev) => {
      if (prev.length >= JIRA_FEEDBACK_MAX_IMAGES) return prev;
      const next = [...prev];
      for (const file of arr) {
        if (next.length >= JIRA_FEEDBACK_MAX_IMAGES) break;
        if (file.size > JIRA_FEEDBACK_MAX_IMAGE_BYTES) continue;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        next.push({ id, file, url: URL.createObjectURL(file) });
      }
      return next;
    });
  }, []);

  const removePendingImage = useCallback((id: string) => {
    setPendingImages((prev) => {
      const x = prev.find((p) => p.id === id);
      if (x) URL.revokeObjectURL(x.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const onRegionScreenshot = useCallback(async () => {
    if (!jiraTokenConfigured) return;
    if (pendingImages.length >= JIRA_FEEDBACK_MAX_IMAGES) {
      setError(`Limite de ${JIRA_FEEDBACK_MAX_IMAGES} imagens.`);
      return;
    }
    setRegionScreenshotBusy(true);
    setError(null);
    try {
      const r = await runRegionScreenshotFlow();
      if (!r.ok) {
        if (r.message !== "Captura cancelada.") setError(r.message);
        return;
      }
      if (r.file.size > JIRA_FEEDBACK_MAX_IMAGE_BYTES) {
        setError(
          `Imagem demasiado grande (máx. ${JIRA_FEEDBACK_MAX_IMAGE_BYTES / (1024 * 1024)} MB).`,
        );
        return;
      }
      addImageFiles([r.file]);
    } catch (e) {
      setError(
        isExtensionContextInvalidatedError(e)
          ? "Recarregue a página (F5): a ligação à extensão expirou."
          : "Falha na captura por região.",
      );
    } finally {
      setRegionScreenshotBusy(false);
    }
  }, [addImageFiles, jiraTokenConfigured, pendingImages.length]);

  const loadRepoTargets = useCallback(async () => {
    const gen = ++integrationsLoadGenRef.current;
    setIntegrationsFetchState("loading");
    setRepoListIssue(null);
    try {
      const r = (await chrome.runtime.sendMessage({ type: "LIST_REPO_TARGETS" })) as {
        repos?: RepoOption[];
        githubTokenConfigured?: boolean;
        jiraTokenConfigured?: boolean;
        fullNetworkDiagnostic?: boolean;
        captureMode?: CaptureModeV1;
        loadFailed?: boolean;
        jiraBoards?: JiraBoardOption[];
        jiraDefaultBoardId?: string;
        jiraBoardsError?: string;
      };
      if (r && "loadFailed" in r && r.loadFailed) {
        setRepoTargets([]);
        setRepoIndex(0);
        setGithubTokenConfigured(false);
        setJiraTokenConfigured(false);
        setFullNetworkDiagnosticEnabled(false);
        setCaptureMode("debug-interno");
        setJiraBoardsForModal([]);
        setSelectedJiraBoardId("");
        setJiraBoardsListError(null);
        setRepoListIssue("loadFailed");
        return;
      }
      const list = Array.isArray(r?.repos) ? r.repos : [];
      const ghOk = Boolean(r?.githubTokenConfigured);
      const jiraOk = Boolean(r?.jiraTokenConfigured);
      setFullNetworkDiagnosticEnabled(Boolean(r?.fullNetworkDiagnostic));
      setCaptureMode(normalizeCaptureMode(r?.captureMode));
      setGithubTokenConfigured(ghOk);
      setJiraTokenConfigured(jiraOk);
      setForm((f) => {
        let sendToGitHub = f.sendToGitHub;
        let sendToJira = f.sendToJira;
        if (!ghOk) sendToGitHub = false;
        if (!jiraOk) sendToJira = false;
        if (ghOk && !jiraOk) {
          sendToGitHub = true;
          sendToJira = false;
        } else if (!ghOk && jiraOk) {
          sendToGitHub = false;
          sendToJira = true;
        } else if (ghOk && jiraOk) {
          if (!sendToGitHub && !sendToJira) {
            sendToGitHub = true;
            sendToJira = false;
          }
        } else {
          sendToGitHub = false;
          sendToJira = false;
        }
        return { ...f, sendToGitHub, sendToJira };
      });
      setRepoTargets(list);
      setRepoIndex((prev) => {
        if (list.length === 0) return 0;
        return Math.min(Math.max(0, prev), list.length - 1);
      });

      const jiraBoards = Array.isArray(r?.jiraBoards) ? r.jiraBoards : [];
      const jiraDefRaw = typeof r?.jiraDefaultBoardId === "string" ? r.jiraDefaultBoardId.trim() : "";
      const jbErr = typeof r?.jiraBoardsError === "string" ? r.jiraBoardsError : null;
      setJiraBoardsForModal(jiraBoards);
      setJiraBoardsListError(jbErr);
      setSelectedJiraBoardId((prev) => {
        if (prev && jiraBoards.some((b) => String(b.id) === prev)) return prev;
        if (jiraDefRaw && jiraBoards.some((b) => String(b.id) === jiraDefRaw)) return jiraDefRaw;
        return jiraBoards[0] ? String(jiraBoards[0].id) : "";
      });
    } catch (e) {
      setRepoTargets([]);
      setRepoIndex(0);
      setGithubTokenConfigured(false);
      setJiraTokenConfigured(false);
      setFullNetworkDiagnosticEnabled(false);
      setJiraBoardsForModal([]);
      setSelectedJiraBoardId("");
      setJiraBoardsListError(null);
      setRepoListIssue(isExtensionContextInvalidatedError(e) ? "context" : "other");
    } finally {
      if (gen !== integrationsLoadGenRef.current) return;
      if (openRef.current) setIntegrationsFetchState("done");
      else setIntegrationsFetchState("idle");
    }
  }, []);

  useLayoutEffect(() => {
    if (open) setIntegrationsFetchState("loading");
    else setIntegrationsFetchState("idle");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadRepoTargets();
  }, [open, loadRepoTargets]);

  useEffect(() => {
    if (!open || postSubmit || !fullNetworkDiagnosticEnabled) {
      setNetworkDiagError(null);
      void chrome.runtime.sendMessage({ type: "STOP_NETWORK_DIAGNOSTIC" }).catch(() => {});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = (await chrome.runtime.sendMessage({ type: "START_NETWORK_DIAGNOSTIC" })) as {
          ok?: boolean;
          message?: string;
          active?: boolean;
        };
        if (cancelled) return;
        if (!r?.ok) {
          setNetworkDiagError(r?.message ?? "Não foi possível iniciar a captura de rede.");
        } else {
          setNetworkDiagError(null);
        }
      } catch {
        if (!cancelled) setNetworkDiagError("Não foi possível falar com o processo da extensão.");
      }
    })();
    return () => {
      cancelled = true;
      void chrome.runtime.sendMessage({ type: "STOP_NETWORK_DIAGNOSTIC" }).catch(() => {});
    };
  }, [open, postSubmit, fullNetworkDiagnosticEnabled]);

  useEffect(() => {
    const onCap = (e: Event) => {
      if (eventPathTouchesExtensionUi(e)) return;
      const raw = e.target;
      if (!raw || !(raw instanceof Node)) return;
      const el = raw instanceof Element ? raw : raw.parentElement;
      if (!el || elementIsInsideExtensionUi(el)) return;
      setLastTarget(el);
    };
    document.addEventListener("click", onCap, true);
    document.addEventListener("focusin", onCap, true);
    return () => {
      document.removeEventListener("click", onCap, true);
      document.removeEventListener("focusin", onCap, true);
    };
  }, []);

  const routeInfo = useMemo(() => resolvePageRouteInfo(window.location), [routeRevision]);
  const routePathWithQuery = useMemo(
    () => `${routeInfo.pathname}${routeInfo.routeSearch || ""}`,
    [routeInfo.pathname, routeInfo.routeSearch],
  );
  const routeStatusTitle = useMemo(
    () => `${routeInfo.routeSlug} ${routePathWithQuery}`,
    [routeInfo.routeSlug, routePathWithQuery],
  );

  const payload = useMemo((): CreateIssuePayload => {
    const bridge = readBridgeSnapshot();
    const target =
      lastTarget && !elementIsInsideExtensionUi(lastTarget) ? lastTarget : null;
    const capturedContext = form.includeTechnicalContext
      ? buildCapturedIssueContext({
          lastTarget: target,
          bridge,
          captureMode,
          sessionInteractionTimeline:
            sessionTimelinePreview.length > 0 ? sessionTimelinePreview : undefined,
        })
      : undefined;
    return { ...form, capturedContext };
  }, [form, lastTarget, routeRevision, captureMode, sessionTimelinePreview]);

  const previewMd = useMemo(() => buildIssueBody(payload), [payload]);

  const selectedRepo = repoTargets[repoIndex];
  const hasAnyDestination = githubTokenConfigured || jiraTokenConfigured;
  const integrationsLoading = integrationsFetchState === "loading";
  const integrationsReady = integrationsFetchState === "done";
  const canSubmit = (() => {
    if (!hasAnyDestination) return false;
    if (!form.sendToGitHub && !form.sendToJira) return false;
    if (!form.whatHappened.trim()) return false;
    if (form.sendToGitHub || form.sendToJira) {
      if (!form.title.trim()) return false;
    }
    if (form.sendToGitHub && !selectedRepo) return false;
    if (form.sendToJira) {
      if (!isJiraMotivoAbertura(form.jiraMotivoAbertura)) return false;
      if (jiraTokenConfigured) {
        if (jiraBoardsListError) return false;
        if (jiraBoardsForModal.length === 0) return false;
        if (!selectedJiraBoardId.trim()) return false;
      }
    }
    return true;
  })();

  const openOptions = useCallback(() => {
    setError(null);
    void (async () => {
      try {
        const r = (await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" })) as { ok?: boolean };
        if (r && "ok" in r && r.ok === false) {
          setError("Não foi possível abrir as configurações. Recarregue a página (F5) e tente de novo.");
        }
      } catch (e) {
        setError(
          isExtensionContextInvalidatedError(e)
            ? "Extensão foi recarregada: recarregue esta página (F5) para voltar a usar o feedback."
            : "Não foi possível abrir as configurações.",
        );
      }
    })();
  }, []);

  const resetFlow = () => {
    persistPendingImagesToExtensionTab([]);
    setPendingImages((prev) => {
      for (const x of prev) URL.revokeObjectURL(x.url);
      return [];
    });
    setForm(destinationDefaults(githubTokenConfigured, jiraTokenConfigured));
    setError(null);
    setPostSubmit(null);
    setTab("form");
  };

  /** Fecha o fluxo, limpa rascunho/imagens e grava estado vazio na sessão da aba (sessionStorage + SW). */
  const closeModal = useCallback(() => {
    void chrome.runtime.sendMessage({ type: "STOP_NETWORK_DIAGNOSTIC" }).catch(() => {});
    void chrome.runtime.sendMessage({ type: "QAF_TIMELINE_SESSION_END" }).catch(() => {});
    persistPendingImagesToExtensionTab([]);
    setNetworkDiagError(null);
    setLastTarget(null);
    const fresh = destinationDefaults(githubTokenConfigured, jiraTokenConfigured);
    setPendingImages((prev) => {
      for (const x of prev) URL.revokeObjectURL(x.url);
      return [];
    });
    setForm(fresh);
    setError(null);
    setPostSubmit(null);
    setSessionTimelinePreview([]);
    setTab("form");
    setOpen(false);
    setSheetCollapsed(false);
    setFabDismissed(true);
    setRepoIndex(0);
    setSelectedJiraBoardId("");
    const snap = buildTabSnapshotV2({
      open: false,
      sheetCollapsed: false,
      repoIndex: 0,
      selectedJiraBoardId: "",
      panelTab: "form",
      form: fresh,
      fabDismissed: true,
    });
    writeTabSnapshotToSession(snap);
    persistTabSnapshotToExtensionTab(snap);
  }, [githubTokenConfigured, jiraTokenConfigured]);

  const collapseToFab = useCallback(() => {
    setSheetCollapsed(true);
  }, []);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* fallback silencioso */
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let jiraImageAttachments: JiraImageAttachmentPayload[] | undefined;
      if (form.sendToJira && pendingImages.length > 0) {
        jiraImageAttachments = [];
        for (const { file } of pendingImages) {
          if (file.size > JIRA_FEEDBACK_MAX_IMAGE_BYTES) {
            setError(`Imagem demasiado grande (máx. ${JIRA_FEEDBACK_MAX_IMAGE_BYTES / (1024 * 1024)} MB por arquivo).`);
            setBusy(false);
            return;
          }
          const base64 = await fileToBase64(file);
          jiraImageAttachments.push({
            fileName: safeImageFileNameForJira(file.name),
            mimeType: file.type || "image/png",
            base64,
          });
        }
      }

      const bridge = readBridgeSnapshot();
      const target =
        lastTarget && !elementIsInsideExtensionUi(lastTarget) ? lastTarget : null;
      const sessionTl = form.includeTechnicalContext ? await fetchSessionTimelineForSubmit() : [];
      const capturedContextForSend = form.includeTechnicalContext
        ? buildCapturedIssueContext({
            lastTarget: target,
            bridge,
            captureMode,
            sessionInteractionTimeline: sessionTl.length > 0 ? sessionTl : undefined,
          })
        : undefined;
      const submitPayload: CreateIssuePayload = { ...form, capturedContext: capturedContextForSend };

      const res = (await chrome.runtime.sendMessage({
        type: "CREATE_ISSUE",
        payload: {
          ...submitPayload,
          ...(jiraImageAttachments?.length ? { jiraImageAttachments } : {}),
          ...(form.sendToJira && selectedJiraBoardId.trim()
            ? { jiraSoftwareBoardId: selectedJiraBoardId.trim() }
            : {}),
        },
        owner: selectedRepo?.owner,
        repo: selectedRepo?.repo,
      })) as {
        ok: boolean;
        message?: string;
        githubUrl?: string;
        jiraUrl?: string;
        jiraIssueBrowseUrl?: string;
        jiraSoftwareBoardIdUsed?: string;
        warnings?: string[];
      };

      if (res && res.ok && (res.githubUrl || res.jiraUrl)) {
        try {
          await chrome.runtime.sendMessage({ type: "QAF_TIMELINE_SESSION_END" });
        } catch {
          /* ignore */
        }
        setSessionTimelinePreview([]);
        const warnings = [...(res.warnings ?? [])];
        if (!form.sendToJira && pendingImages.length > 0) {
          warnings.push(
            "Há imagens anexadas, mas só são enviadas ao Jira. Marque «Enviar para Jira» e envie de novo para as incluir.",
          );
        }
        persistPendingImagesToExtensionTab([]);
        setPendingImages((prev) => {
          for (const x of prev) URL.revokeObjectURL(x.url);
          return [];
        });
        setPostSubmit({
          github: res.githubUrl,
          jira: res.jiraUrl,
          jiraIssueBrowse: res.jiraIssueBrowseUrl,
          jiraBoardIdUsed: res.jiraSoftwareBoardIdUsed,
          warnings: warnings.length ? warnings : undefined,
        });
      } else {
        setError((res as { message?: string }).message ?? "Falha ao enviar feedback.");
      }
    } catch (e) {
      setError(
        isExtensionContextInvalidatedError(e)
          ? "Recarregue a página (F5): a ligação à extensão expirou."
          : "Não foi possível falar com o processo da extensão.",
      );
    } finally {
      setBusy(false);
    }
  };

  const onField =
    (key: keyof IssueFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((f) => ({ ...f, [key]: v } as IssueFormState));
    };

  const openModal = useCallback(() => {
    setFabDismissed(false);
    setOpen(true);
    setSheetCollapsed(false);
    setError(null);
    setPostSubmit(null);
    setTab("form");
  }, []);

  const openOrExpandFeedback = useCallback(() => {
    if (open && sheetCollapsed) {
      setSheetCollapsed(false);
      return;
    }
    openModal();
  }, [open, sheetCollapsed, openModal]);

  return (
    <div className="qaf-portal-root">
      <style>{shadowCss}</style>
      {!fabDismissed && (
        <div className="qaf-wrap">
          <div className="qaf-fab-cluster">
            <button
              type="button"
              className={`qaf-fab qaf-fab-icon-only${integrationsLoading && open ? " qaf-fab--integrations-loading" : ""}`}
              onClick={openOrExpandFeedback}
              aria-label="Abrir feedback"
              aria-busy={integrationsLoading && open}
              title={
                integrationsLoading && open
                  ? "Carregando integrações GitHub/Jira…"
                  : undefined
              }
            >
              <FeedbackFabIcon />
            </button>
            <button
              type="button"
              className="qaf-fab-dismiss"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
              }}
              aria-label="Fechar botão de feedback e limpar"
              title="Oculta o botão e limpa o rascunho nesta aba. Para voltar a mostrar, clique no ícone da extensão."
            >
              ×
            </button>
          </div>
        </div>
      )}

      {open && !sheetCollapsed && (
        <>
          <button
            type="button"
            className="qaf-backdrop qaf-backdrop--sheet"
            aria-label="Recolher painel"
            title="Recolher para o botão flutuante"
            onClick={collapseToFab}
          />
          <div
            className="qaf-modal qaf-modal--dock"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qaf-dlg-title"
          >
            <div className="qaf-modal-header">
              <div className="qaf-modal-header-brand">
                <div className="qaf-modal-avatar">
                  <FeedbackFabIcon />
                </div>
                <div className="qaf-modal-header-text">
                  <h2 className="qaf-modal-title" id="qaf-dlg-title">
                    Issue Assistant
                  </h2>
                  <p className="qaf-modal-subtitle">
                    Transforma evidências da sessão em reports mais completos para Jira e GitHub.
                    {integrationsReady && !hasAnyDestination ? (
                      <>
                        {" "}
                        <span className="qaf-modal-subtitle-note">
                          Configure o token do <strong>GitHub</strong> e/ou do <strong>Jira</strong> nas opções para
                          enviar o relatório por API.
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="qaf-modal-header-actions">
                <button
                  type="button"
                  className="qaf-modal-icon-btn"
                  onClick={() => setSheetCollapsed(true)}
                  aria-label="Recolher painel"
                  aria-expanded={true}
                  title="Recolher painel — o formulário mantém-se; clique na capivara para reabrir"
                >
                  <HeaderCollapseIcon />
                </button>
                <button
                  type="button"
                  className="qaf-modal-icon-btn"
                  onClick={openOptions}
                  aria-label="Abrir configurações"
                  title="Configurações"
                >
                  <HeaderSettingsIcon />
                </button>
              </div>
            </div>

            {!postSubmit && githubTokenConfigured && form.sendToGitHub && (
              <div className="qaf-repo-bar qaf-field">
                <label className="qaf-label" htmlFor="qaf-repo">
                  Repositório destino (GitHub)
                </label>
                {repoListIssue === "context" ? (
                  <div className="qaf-error qaf-error-warn">
                    <strong>Atualize esta página (F5).</strong> A extensão foi recarregada ou atualizada e este separador
                    perdeu a ligação ao processo da extensão. Depois volte a abrir o feedback.
                  </div>
                ) : repoListIssue === "other" || repoListIssue === "loadFailed" ? (
                  <div className="qaf-error">
                    {repoListIssue === "loadFailed"
                      ? "Não foi possível ler as configurações guardadas."
                      : "Não foi possível obter a lista de repositórios."}{" "}
                    <button type="button" className="qaf-link" onClick={() => void loadRepoTargets()}>
                      Tentar novamente
                    </button>
                    {" · "}
                    <button type="button" className="qaf-link" onClick={openOptions}>
                      Abrir configurações
                    </button>
                  </div>
                ) : repoTargets.length === 0 ? (
                  <div className="qaf-error">
                    Nenhum repositório configurado. Adicione repositórios na extensão e clique em{" "}
                    <strong>Salvar</strong>.{" "}
                    <button type="button" className="qaf-link" onClick={openOptions}>
                      Abrir configurações
                    </button>
                  </div>
                ) : (
                  <select
                    id="qaf-repo"
                    className="qaf-select"
                    value={repoIndex}
                    onChange={(e) => setRepoIndex(Number(e.target.value))}
                  >
                    {repoTargets.map((t, i) => (
                      <option key={`${i}-${t.owner}-${t.repo}`} value={i}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {!postSubmit && (
              <div className="qaf-tabs">
                <button
                  type="button"
                  className={`qaf-tab ${tab === "form" ? "qaf-tab-active" : ""}`}
                  onClick={() => setTab("form")}
                >
                  Formulário
                </button>
                <button
                  type="button"
                  className={`qaf-tab ${tab === "preview" ? "qaf-tab-active" : ""}`}
                  onClick={() => setTab("preview")}
                >
                  Preview
                </button>
              </div>
            )}

            <div className={postSubmit ? "qaf-body qaf-body--post-submit" : "qaf-body"}>
              {!postSubmit ? (
                <div className="qaf-status-strip">
                  <div className="qaf-status-strip-inner" title={routeStatusTitle}>
                    <div className="qaf-status-strip-row qaf-status-strip-row--top">
                      <span className="qaf-route-slug">{routeInfo.routeSlug}</span>
                      <div
                        className="qaf-status-badges"
                        role="list"
                        aria-label="Estado das integrações nas opções"
                      >
                        <span
                          className={`qaf-status-badge ${jiraTokenConfigured ? "qaf-status-badge--on" : "qaf-status-badge--off"}`}
                          role="listitem"
                          title={
                            jiraTokenConfigured
                              ? "Jira: token configurado."
                              : "Jira: configure o token nas opções."
                          }
                        >
                          Jira
                        </span>
                        <span
                          className={`qaf-status-badge ${githubTokenConfigured ? "qaf-status-badge--on" : "qaf-status-badge--off"}`}
                          role="listitem"
                          title={
                            githubTokenConfigured
                              ? "GitHub: token configurado."
                              : "GitHub: configure o token nas opções."
                          }
                        >
                          GitHub
                        </span>
                        <span
                          className={`qaf-status-badge ${fullNetworkDiagnosticEnabled ? "qaf-status-badge--on" : "qaf-status-badge--off"}`}
                          role="listitem"
                          title={
                            fullNetworkDiagnosticEnabled
                              ? "HAR ativo: só esta aba entra no .har. O aviso de «debugging» do Chrome pode aparecer noutras abas — é global ao navegador."
                              : "HAR: ative o diagnóstico de rede nas opções para anexar HAR ao Jira."
                          }
                        >
                          HAR
                        </span>
                        <span
                          className={`qaf-status-badge ${captureMode === "producao-sensivel" ? "qaf-status-badge--caution" : "qaf-status-badge--on"}`}
                          role="listitem"
                          title={
                            captureMode === "producao-sensivel"
                              ? "Modo Produção sensível: menos dados brutos no texto da issue (veja Opções)."
                              : "Modo Debug interno: mais contexto técnico na issue (padrão)."
                          }
                        >
                          {captureMode === "producao-sensivel" ? "Ctx restrito" : "Ctx debug"}
                        </span>
                      </div>
                    </div>
                    <div className="qaf-route-path-line">{routePathWithQuery}</div>
                  </div>
                </div>
              ) : null}
              {fullNetworkDiagnosticEnabled && !postSubmit && networkDiagError ? (
                <div className="qaf-network-diag qaf-network-diag--error" role="alert">
                  <strong>Captura de rede:</strong> {networkDiagError}
                </div>
              ) : null}
              {postSubmit ? (
                <div className="qaf-success">
                  <div className="qaf-success-hero">
                    <div
                      className={
                        CHECK_POSITIVO_URL
                          ? "qaf-success-check qaf-success-check--illustration"
                          : "qaf-success-check"
                      }
                      aria-hidden
                    >
                      <SuccessCheckIllustration />
                    </div>
                    <h3 className="qaf-success-title">Evidência criada</h3>
                    {postSubmit.jiraBoardIdUsed ? (
                      <p className="qaf-success-board-meta" role="status">
                        Issue Jira criada no quadro ID <strong>{postSubmit.jiraBoardIdUsed}</strong>
                        {selectedJiraBoardId.trim() &&
                        selectedJiraBoardId.trim() !== postSubmit.jiraBoardIdUsed.trim() ? (
                          <span className="qaf-success-board-meta-warn">
                            {" "}
                            (seleção no formulário era {selectedJiraBoardId.trim()})
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="qaf-success-cards">
                    {postSubmit.github ? (
                      <div className="qaf-success-card">
                        <div className="qaf-success-card-row">
                          <div className="qaf-success-card-head">
                            <span className="qaf-success-card-icon" aria-hidden>
                              <GitHubMarkIcon />
                            </span>
                            <span className="qaf-success-card-label">GitHub</span>
                          </div>
                          <div className="qaf-success-card-actions">
                            <button
                              type="button"
                              className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                              onClick={() => copyText(postSubmit.github!)}
                            >
                              <CopyIcon /> Copiar
                            </button>
                            <a
                              className="qaf-btn qaf-btn-sm qaf-btn-access"
                              href={postSubmit.github}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Acessar
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {postSubmit.jira ? (
                      <div className="qaf-success-card">
                        <div className="qaf-success-card-row">
                          <div className="qaf-success-card-head">
                            <span className="qaf-success-card-icon" aria-hidden>
                              <JiraBoardCardIcon />
                            </span>
                            <span className="qaf-success-card-label">Jira Board</span>
                          </div>
                          <div className="qaf-success-card-actions">
                            <button
                              type="button"
                              className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                              onClick={() => copyText(postSubmit.jira!)}
                            >
                              <CopyIcon /> Copiar
                            </button>
                            <a
                              className="qaf-btn qaf-btn-sm qaf-btn-access"
                              href={postSubmit.jira}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Acessar
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {postSubmit.jiraIssueBrowse ? (
                      <div className="qaf-success-card">
                        <div className="qaf-success-card-row">
                          <div className="qaf-success-card-head">
                            <span className="qaf-success-card-icon" aria-hidden>
                              <JiraIssueCardIcon />
                            </span>
                            <span className="qaf-success-card-label">Jira Issue</span>
                          </div>
                          <div className="qaf-success-card-actions">
                            <button
                              type="button"
                              className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                              onClick={() => copyText(postSubmit.jiraIssueBrowse!)}
                            >
                              <CopyIcon /> Copiar
                            </button>
                            <a
                              className="qaf-btn qaf-btn-sm qaf-btn-access"
                              href={postSubmit.jiraIssueBrowse}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Acessar
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {postSubmit.warnings?.length ? (
                    <div className="qaf-error qaf-error-warn">
                      {postSubmit.warnings.map((w) => (
                        <div key={w}>{w}</div>
                      ))}
                    </div>
                  ) : null}
                  <div className="qaf-footer-eq qaf-success-footer">
                    <div className="qaf-footer-eq-row qaf-footer-eq-row--stack">
                      <button type="button" className="qaf-btn qaf-btn-submit" onClick={resetFlow}>
                        Criar novo
                      </button>
                      <button type="button" className="qaf-btn qaf-btn-secondary" onClick={closeModal}>
                        Fechar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {error && <div className="qaf-error">{error}</div>}
                  {speechError ? (
                    <div className="qaf-speech-notice qaf-speech-notice--error" role="alert">
                      {speechError}
                    </div>
                  ) : null}
                  {listeningField ? (
                    <div className="qaf-speech-live" role="status" aria-live="polite">
                      A escutar no {listeningField === "title" ? "título" : "campo da descrição"}… clique no microfone
                      outra vez para parar.
                    </div>
                  ) : null}

                  {tab === "form" ? (
                    <>
                      {integrationsLoading ? (
                        <div className="qaf-integrations-loading" role="status" aria-live="polite">
                          <span className="qaf-integrations-loading__spinner" aria-hidden />
                          <span>
                            Carregando configurações do GitHub/Jira… Isso costuma levar só um instante após recarregar
                            a página.
                          </span>
                        </div>
                      ) : !hasAnyDestination ? (
                        <div className="qaf-config-missing">
                          <strong>Nenhum destino configurado.</strong> Adicione o <strong>GitHub token</strong> e/ou o{" "}
                          <strong>API token Jira</strong> nas opções da extensão e clique em <strong>Salvar</strong>.{" "}
                          <button type="button" className="qaf-modal-settings-link" onClick={openOptions}>
                            Abrir configurações
                          </button>
                        </div>
                      ) : githubTokenConfigured && jiraTokenConfigured ? (
                        <div className="qaf-field">
                          <span className="qaf-label" id="qaf-dest-label">
                            Destino
                          </span>
                          <div
                            className="qaf-dest-segment"
                            role="tablist"
                            aria-labelledby="qaf-dest-label"
                          >
                            <button
                              type="button"
                              role="tab"
                              aria-selected={form.sendToGitHub && !form.sendToJira}
                              className={`qaf-dest-seg-btn ${form.sendToGitHub && !form.sendToJira ? "qaf-dest-seg-btn-active" : ""}`}
                              onClick={() =>
                                setForm((f) => ({ ...f, sendToGitHub: true, sendToJira: false }))
                              }
                            >
                              GitHub
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={!form.sendToGitHub && form.sendToJira}
                              className={`qaf-dest-seg-btn ${!form.sendToGitHub && form.sendToJira ? "qaf-dest-seg-btn-active" : ""}`}
                              onClick={() =>
                                setForm((f) => ({ ...f, sendToGitHub: false, sendToJira: true }))
                              }
                            >
                              Jira
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={form.sendToGitHub && form.sendToJira}
                              className={`qaf-dest-seg-btn ${form.sendToGitHub && form.sendToJira ? "qaf-dest-seg-btn-active" : ""}`}
                              onClick={() =>
                                setForm((f) => ({ ...f, sendToGitHub: true, sendToJira: true }))
                              }
                            >
                              Ambos
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {form.sendToJira && jiraTokenConfigured ? (
                        <div className="qaf-field">
                          <label className="qaf-label" htmlFor="qaf-jira-board">
                            Board do Jira para vincular <span className="qaf-required">*</span>
                          </label>
                          {jiraBoardsListError ? (
                            <div className="qaf-error">
                              Não foi possível carregar os quadros: {jiraBoardsListError}{" "}
                              <button type="button" className="qaf-link" onClick={() => void loadRepoTargets()}>
                                Tentar novamente
                              </button>
                            </div>
                          ) : jiraBoardsForModal.length === 0 ? (
                            <div className="qaf-error qaf-error-warn">
                              Nenhum quadro disponível. Confirme o token Jira e o ID do quadro nas opções, ou ajuste{" "}
                              <strong>BOARD_ID</strong> ou <strong>VITE_JIRA_BOARD_ALLOWLIST</strong> no{" "}
                              <code>.env</code> antes do <code>npm run build</code>.
                            </div>
                          ) : (
                            <select
                              id="qaf-jira-board"
                              className="qaf-select"
                              value={selectedJiraBoardId}
                              onChange={(e) => setSelectedJiraBoardId(e.target.value)}
                            >
                              {jiraBoardsForModal.map((b) => (
                                <option key={b.id} value={String(b.id)}>
                                  {b.name} ({b.type ?? "?"}) — ID {b.id}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : null}
                      {form.sendToJira && (
                        <div
                          className="qaf-field qaf-field--motivo-abertura"
                          role="radiogroup"
                          aria-labelledby="qaf-motivo-label"
                        >
                          <span className="qaf-label" id="qaf-motivo-label">
                            Motivo de abertura <span className="qaf-required">*</span>
                          </span>
                          <div className="qaf-chip-group">
                            {JIRA_MOTIVO_ABERTURA_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                role="radio"
                                aria-checked={form.jiraMotivoAbertura === opt}
                                className={`qaf-chip ${form.jiraMotivoAbertura === opt ? "qaf-chip--selected" : ""}`}
                                onClick={() => setForm((f) => ({ ...f, jiraMotivoAbertura: opt }))}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {(form.sendToGitHub || form.sendToJira) && (
                        <div className="qaf-field">
                          <label className="qaf-label" htmlFor="qaf-title">
                            Título <span className="qaf-required">*</span>
                          </label>
                          <div className="qaf-input-with-mic">
                            <input
                              ref={titleInputRef}
                              id="qaf-title"
                              className="qaf-input qaf-input-flex"
                              value={form.title}
                              onChange={onField("title")}
                              placeholder="Resumo (issue no GitHub / Jira)"
                              title={
                                speechSupported && secureContext
                                  ? "Voz do Chrome: microfone para falar ou parar. Também ditado do SO (ex.: Win+H)."
                                  : "Ditado do sistema após focar o campo"
                              }
                            />
                            <button
                              type="button"
                              className={`qaf-dictation-mic-btn qaf-dictation-mic-btn--inline ${
                                listeningField === "title" ? "qaf-dictation-mic-btn--listening" : ""
                              }`}
                              aria-label={
                                listeningField === "title"
                                  ? "Parar reconhecimento de voz no título"
                                  : speechSupported && secureContext
                                    ? "Falar no título (voz do Chrome)"
                                    : "Focar título para ditado do sistema"
                              }
                              aria-pressed={listeningField === "title"}
                              title={
                                speechSupported && secureContext
                                  ? `Voz do Chrome (idioma: ${speechRecognitionLang}).`
                                  : getDictationMicTooltip("title", dictationPlatform)
                              }
                              onClick={() => {
                                toggleField("title");
                                titleInputRef.current?.focus();
                                titleInputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                              }}
                            >
                              <MicIcon />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="qaf-field">
                        <label className="qaf-label" htmlFor="qaf-what">
                          Descreva o problema <span className="qaf-required">*</span>
                        </label>
                        <div className="qaf-textarea-with-mic">
                          <textarea
                            ref={whatTextareaRef}
                            id="qaf-what"
                            className="qaf-textarea qaf-textarea-flex"
                            value={form.whatHappened}
                            onChange={onField("whatHappened")}
                            onPaste={(e) => {
                              if (!jiraTokenConfigured) return;
                              const items = e.clipboardData?.items;
                              if (!items?.length) return;
                              const files: File[] = [];
                              for (let i = 0; i < items.length; i++) {
                                const it = items[i];
                                if (it?.kind === "file" && it.type.startsWith("image/")) {
                                  const f = it.getAsFile();
                                  if (f) files.push(f);
                                }
                              }
                              if (!files.length) return;
                              e.preventDefault();
                              const bad = files.find((f) => f.size > JIRA_FEEDBACK_MAX_IMAGE_BYTES);
                              if (bad) {
                                setError(
                                  `Imagem colada demasiado grande (máx. ${JIRA_FEEDBACK_MAX_IMAGE_BYTES / (1024 * 1024)} MB).`,
                                );
                                return;
                              }
                              setError(null);
                              addImageFiles(files);
                            }}
                            placeholder="Aqui você pode relatar o comportamento observado (pode colar prints ou simplesmente descrever)"
                            title={
                              speechSupported && secureContext
                                ? "Voz do Chrome no microfone ao lado; pode colar imagens com Ctrl+V (Jira)."
                                : "Ditado do SO pelo microfone ou atalho; pode colar imagens com Ctrl+V (Jira)"
                            }
                          />
                          <button
                            type="button"
                            className={`qaf-dictation-mic-btn qaf-dictation-mic-btn--inline qaf-dictation-mic-btn--textarea ${
                              listeningField === "whatHappened" ? "qaf-dictation-mic-btn--listening" : ""
                            }`}
                            aria-label={
                              listeningField === "whatHappened"
                                ? "Parar reconhecimento de voz na descrição"
                                : speechSupported && secureContext
                                  ? "Falar na descrição (reconhecimento de voz do Chrome)"
                                  : "Focar descrição para ditado do sistema"
                            }
                            aria-pressed={listeningField === "whatHappened"}
                            title={
                              speechSupported && secureContext
                                ? `Voz do Chrome (idioma: ${speechRecognitionLang}). Clique para falar ou parar.`
                                : getDictationMicTooltip("what", dictationPlatform)
                            }
                            onClick={() => {
                              toggleField("whatHappened");
                              whatTextareaRef.current?.focus();
                              whatTextareaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                            }}
                          >
                            <MicIcon />
                          </button>
                        </div>
                      </div>
                      {jiraTokenConfigured ? (
                        <div className="qaf-img-field">
                          <span className="qaf-label">
                            Prints do problema (opcional) - {pendingImages.length}/{JIRA_FEEDBACK_MAX_IMAGES}
                          </span>
                          <div className="qaf-img-actions">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const fl = e.target.files;
                                if (!fl?.length) return;
                                const oversize = Array.from(fl).find(
                                  (f) => f.size > JIRA_FEEDBACK_MAX_IMAGE_BYTES,
                                );
                                if (oversize) {
                                  setError(
                                    `Ficheiro demasiado grande (máx. ${JIRA_FEEDBACK_MAX_IMAGE_BYTES / (1024 * 1024)} MB): ${oversize.name}`,
                                  );
                                  e.target.value = "";
                                  return;
                                }
                                setError(null);
                                addImageFiles(fl);
                                e.target.value = "";
                              }}
                            />
                            <div className="qaf-img-btn-row">
                              <button
                                type="button"
                                className="qaf-btn-ghost qaf-btn-ghost--dashed"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                Selecionar imagem
                              </button>
                              <button
                                type="button"
                                className="qaf-btn-ghost"
                                disabled={
                                  regionScreenshotBusy ||
                                  pendingImages.length >= JIRA_FEEDBACK_MAX_IMAGES
                                }
                                onClick={() => void onRegionScreenshot()}
                              >
                                {regionScreenshotBusy ? "A capturar…" : "Capturar tela"}
                              </button>
                            </div>
                            <p className="qaf-img-hint">
                              {!form.sendToJira
                                ? "As imagens só são enviadas ao marcar «Enviar para Jira». "
                                : null}
                              Até {JIRA_FEEDBACK_MAX_IMAGES} imagens, {JIRA_FEEDBACK_MAX_IMAGE_BYTES / (1024 * 1024)} MB
                              cada. «Capturar área» esconde o botão de feedback, permite arrastar um retângulo na página
                              visível e anexa o recorte. Colar captura (Ctrl+V) na descrição também funciona.
                            </p>
                          </div>
                          {pendingImages.length > 0 ? (
                            <div className="qaf-img-strip">
                              {pendingImages.map((im) => (
                                <div key={im.id} className="qaf-img-thumb-wrap">
                                  <img src={im.url} alt="" />
                                  <button
                                    type="button"
                                    className="qaf-img-remove"
                                    aria-label="Remover imagem"
                                    onClick={() => removePendingImage(im.id)}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <label className="qaf-check">
                        <input
                          type="checkbox"
                          checked={form.includeTechnicalContext}
                          onChange={onField("includeTechnicalContext")}
                        />
                        <span className="qaf-check-text">
                          <span className="qaf-check-title">Incluir contexto técnico</span>
                          <span className="qaf-check-hint">
                            URL, viewport e tela (screen), indício desktop/móvel/emulação DevTools, último clique na
                            página (não no botão), console e requests com falha.
                          </span>
                        </span>
                      </label>
                      <div className="qaf-footer-eq">
                        <div className="qaf-footer-eq-row">
                          <button type="button" className="qaf-btn qaf-btn--ghost-cancel" onClick={collapseToFab}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-secondary"
                            onClick={() => copyText(previewMd)}
                          >
                            <CopyIcon /> Copiar
                          </button>
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-submit"
                            disabled={!canSubmit || busy}
                            onClick={submit}
                          >
                            {busy ? "Enviando…" : "Enviar"}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="qaf-preview">{previewMd || "(vazio)"}</div>
                      <div className="qaf-footer-eq">
                        <div className="qaf-footer-eq-row">
                          <button type="button" className="qaf-btn qaf-btn--ghost-cancel" onClick={collapseToFab}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-secondary"
                            onClick={() => copyText(previewMd)}
                          >
                            <CopyIcon /> Copiar
                          </button>
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-submit"
                            disabled={!canSubmit || busy}
                            onClick={submit}
                          >
                            {busy ? "Enviando…" : "Enviar"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
