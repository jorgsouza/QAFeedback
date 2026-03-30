import { createGitHubIssue, testTokenAndListRepos } from "../shared/github-client";
import {
  consumeNetworkHarForTab,
  startNetworkDiagnosticForTab,
  stopNetworkDiagnosticForTab,
} from "./network-debugger-capture";
import { resolveJiraBoardFieldsForIssueCreate } from "../shared/jira-board-filter-resolve";
import {
  createJiraIssue,
  fetchJiraSoftwareBoard,
  jiraResolvedBoardWebUrl,
  listJiraBoards,
  resolveJiraCloudBaseUrl,
  testJiraConnection,
  uploadJiraIssueAttachments,
} from "../shared/jira-client";
import { networkHarJiraDescriptionMarkdown } from "../shared/network-har-jira-help";
import { isJiraMotivoAbertura } from "../shared/jira-motivo";
import {
  BUILTIN_MATCH_PATTERNS,
  matchPatternsForAllowedHost,
  urlMatchesAllowedHosts,
} from "../shared/host-patterns";
import { isAllowedRepoTarget, repoTargetsForUi, resolveRepoTargets } from "../shared/repo-targets";
import { loadSettings } from "../shared/storage";
import { normalizeGitHubRepoRef } from "../shared/github-repo-normalize";
import {
  coerceJiraBoardIdRequest,
  listFilteredJiraBoardsForFeedback,
  resolveJiraBoardIdForCreate,
} from "../shared/jira-boards-list-for-feedback";
import { parseTabSnapshotFromStoredValue } from "../shared/feedback-ui-session";
import {
  parsePendingImagesFromStoredValue,
  qafPendingImagesStorageKey,
} from "../shared/pending-images-session";
import type { InteractionTimelineEntryV1 } from "../shared/types";
import {
  timelineSessionAppend,
  timelineSessionEnd,
  timelineSessionGetForSubmit,
  timelineSessionStart,
} from "./timeline-tab-session";
import {
  abortViewportRecording,
  routeOffscreenVideoSignal,
  startViewportRecording,
  stopViewportRecording,
} from "./video-recording-orchestrator";

const SCRIPT_ID = "qa-feedback-content";

function qafTabUiStorageKey(tabId: number): string {
  return `qafTabUiV1_${tabId}`;
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(qafTabUiStorageKey(tabId));
  void chrome.storage.session.remove(qafPendingImagesStorageKey(tabId));
  void timelineSessionEnd(tabId);
});

async function filterGrantedPatterns(patterns: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of patterns) {
    if (BUILTIN_MATCH_PATTERNS.has(p)) {
      out.push(p);
      continue;
    }
    try {
      if (await chrome.permissions.contains({ origins: [p] })) out.push(p);
    } catch {
      /* ignore */
    }
  }
  return [...new Set(out)];
}

/** Evita corrida: vários listeners chamam refresh ao mesmo tempo e o Chrome acusa ID duplicado. */
let refreshChain: Promise<void> = Promise.resolve();

function scheduleRefreshContentScripts(): void {
  refreshChain = refreshChain
    .then(() => runRefreshContentScripts())
    .catch((err) => console.error("[QA Feedback] refreshContentScripts:", err));
}

async function runRefreshContentScripts(): Promise<void> {
  const settings = await loadSettings();
  const patterns: string[] = [];
  for (const h of settings.allowedHosts) {
    patterns.push(...matchPatternsForAllowedHost(h));
  }
  const matches = await filterGrantedPatterns(patterns);

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch {
    /* script pode não existir */
  }

  if (matches.length === 0) {
    console.warn(
      "[QA Feedback] Nenhum host com permissão para injetar o botão. Salve as opções e aceite as permissões, ou use localhost/127.0.0.1.",
    );
    return;
  }

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: SCRIPT_ID,
        js: ["content.js"],
        matches,
        runAt: "document_idle",
      },
    ]);
  } catch (err) {
    console.error("[QA Feedback] Falha ao registrar content script:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleRefreshContentScripts();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleRefreshContentScripts();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.qaFeedbackSettings) {
    scheduleRefreshContentScripts();
  }
});

function isUrlInjectable(url: string | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  if (u.startsWith("chrome://")) return false;
  if (u.startsWith("chrome-extension://")) return false;
  if (u.startsWith("edge://")) return false;
  if (u.startsWith("about:")) return false;
  if (u.startsWith("devtools://")) return false;
  if (u.startsWith("https://chrome.google.com/webstore")) return false;
  if (u.startsWith("https://chromewebstore.google.com")) return false;
  return u.startsWith("http://") || u.startsWith("https://");
}

/**
 * Se no Chrome estiver "When you click the extension" / "Ao clicar na extensão",
 * os content scripts não rodam sozinhos. activeTab + clique no ícone injeta o UI.
 * Páginas chrome://, Web Store, etc. não permitem injeção — evitamos a chamada para não gerar erro.
 */
async function injectFeedbackUi(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  if (!isUrlInjectable(tab.url)) {
    console.info(
      "[QA Feedback] Use o ícone num site http(s). Páginas internas (chrome://extensões, configurações, etc.) não aceitam o botão de feedback.",
    );
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (err) {
    console.warn("[QA Feedback] Injeção ao clicar no ícone falhou:", err);
  }
}

chrome.action.onClicked.addListener((tab) => {
  void injectFeedbackUi(tab);
});

type CreateIssueMessage = {
  type: "CREATE_ISSUE";
  payload: import("../shared/types").CreateIssuePayload;
  owner?: string;
  repo?: string;
  /** Quadro escolhido no modal (validado no SW face à lista filtrada). */
  jiraSoftwareBoardId?: string;
};

type TestGitHubMessage = {
  type: "TEST_GITHUB";
  token?: string;
};

type TestJiraMessage = { type: "TEST_JIRA" };
/** Campos opcionais substituem o storage (opções ainda não guardadas na página de configuração). */
type JiraTestAndListBoardsMessage = {
  type: "JIRA_TEST_AND_LIST_BOARDS";
  jiraEmail?: string;
  jiraApiToken?: string;
  jiraSiteUrl?: string;
  jiraSoftwareBoardId?: string;
};

type ListRepoTargetsMessage = { type: "LIST_REPO_TARGETS" };
type QafLoadTabUiMessage = { type: "QAF_LOAD_TAB_UI" };
type QafPersistTabUiMessage = { type: "QAF_PERSIST_TAB_UI"; payload: unknown };
type OpenOptionsMessage = { type: "OPEN_OPTIONS" };
type StartNetworkDiagnosticMessage = { type: "START_NETWORK_DIAGNOSTIC" };
type StopNetworkDiagnosticMessage = { type: "STOP_NETWORK_DIAGNOSTIC" };
type CaptureVisibleTabMessage = { type: "CAPTURE_VISIBLE_TAB"; tabId?: number };
type QafTimelineSessionStartMessage = { type: "QAF_TIMELINE_SESSION_START"; sessionId?: string };
type QafTimelineAppendMessage = { type: "QAF_TIMELINE_APPEND"; entries: InteractionTimelineEntryV1[] };
type QafTimelineGetForSubmitMessage = { type: "QAF_TIMELINE_GET_FOR_SUBMIT" };
type QafTimelineSessionEndMessage = { type: "QAF_TIMELINE_SESSION_END" };
type QafLoadPendingImagesMessage = { type: "QAF_LOAD_PENDING_IMAGES" };
type QafPersistPendingImagesMessage = { type: "QAF_PERSIST_PENDING_IMAGES"; payload: unknown };
type QafVideoRecordingStartMessage = { type: "QAF_VIDEO_RECORDING_START"; tabId?: number };
type QafVideoRecordingStopMessage = { type: "QAF_VIDEO_RECORDING_STOP"; sessionId: string };
type QafVideoRecordingAbortMessage = { type: "QAF_VIDEO_RECORDING_ABORT"; sessionId?: string };

type Messages =
  | CreateIssueMessage
  | TestGitHubMessage
  | TestJiraMessage
  | JiraTestAndListBoardsMessage
  | ListRepoTargetsMessage
  | QafLoadTabUiMessage
  | QafPersistTabUiMessage
  | OpenOptionsMessage
  | StartNetworkDiagnosticMessage
  | StopNetworkDiagnosticMessage
  | CaptureVisibleTabMessage
  | QafTimelineSessionStartMessage
  | QafTimelineAppendMessage
  | QafTimelineGetForSubmitMessage
  | QafTimelineSessionEndMessage
  | QafLoadPendingImagesMessage
  | QafPersistPendingImagesMessage
  | QafVideoRecordingStartMessage
  | QafVideoRecordingStopMessage
  | QafVideoRecordingAbortMessage;

chrome.runtime.onMessage.addListener(
  (message: Messages, sender, sendResponse: (r: unknown) => void) => {
    routeOffscreenVideoSignal(message as unknown as Record<string, unknown>);

    if (message.type === "QAF_VIDEO_RECORDING_START") {
      void (async () => {
        const m = message as QafVideoRecordingStartMessage;
        const tabId = typeof m.tabId === "number" ? m.tabId : sender.tab?.id;
        const r = await startViewportRecording(tabId);
        if (r.ok) {
          sendResponse({
            type: "QAF_VIDEO_RECORDING_STARTED" as const,
            sessionId: r.sessionId,
            startedAt: r.startedAt,
            maxDurationSec: r.maxDurationSec,
          });
        } else {
          sendResponse({
            type: "QAF_VIDEO_RECORDING_ERROR" as const,
            code: r.code,
            message: r.message,
          });
        }
      })();
      return true;
    }

    if (message.type === "QAF_VIDEO_RECORDING_STOP") {
      void (async () => {
        const m = message as QafVideoRecordingStopMessage;
        const r = await stopViewportRecording(m.sessionId);
        if (r.ok) {
          sendResponse({
            type: "QAF_VIDEO_RECORDING_STOPPED" as const,
            attachment: r.attachment,
            durationMs: r.durationMs,
            sizeBytes: r.sizeBytes,
          });
        } else {
          sendResponse({
            type: "QAF_VIDEO_RECORDING_ERROR" as const,
            code: r.code,
            message: r.message,
          });
        }
      })();
      return true;
    }

    if (message.type === "QAF_VIDEO_RECORDING_ABORT") {
      void (async () => {
        const m = message as QafVideoRecordingAbortMessage;
        await abortViewportRecording(m.sessionId);
        sendResponse({ ok: true as const });
      })();
      return true;
    }

    if (message.type === "QAF_LOAD_TAB_UI") {
      void (async () => {
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: true as const, state: null });
          return;
        }
        const key = qafTabUiStorageKey(tabId);
        const bag = await chrome.storage.session.get(key);
        const state = parseTabSnapshotFromStoredValue(bag[key]);
        sendResponse({ ok: true as const, state });
      })();
      return true;
    }

    if (message.type === "QAF_PERSIST_TAB_UI") {
      void (async () => {
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: false });
          return;
        }
        const m = message as QafPersistTabUiMessage;
        const parsed = parseTabSnapshotFromStoredValue(m.payload);
        if (!parsed) {
          sendResponse({ ok: false });
          return;
        }
        await chrome.storage.session.set({
          [qafTabUiStorageKey(tabId)]: parsed,
        });
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (message.type === "QAF_LOAD_PENDING_IMAGES") {
      void (async () => {
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: true as const, images: [] });
          return;
        }
        const key = qafPendingImagesStorageKey(tabId);
        const bag = await chrome.storage.session.get(key);
        const raw = bag[key];
        const images = parsePendingImagesFromStoredValue(raw);
        sendResponse({ ok: true as const, images });
      })();
      return true;
    }

    if (message.type === "QAF_PERSIST_PENDING_IMAGES") {
      void (async () => {
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: false });
          return;
        }
        const m = message as QafPersistPendingImagesMessage;
        const images = parsePendingImagesFromStoredValue(m.payload);
        const key = qafPendingImagesStorageKey(tabId);
        try {
          if (images.length === 0) {
            await chrome.storage.session.remove(key);
          } else {
            await chrome.storage.session.set({ [key]: { v: 1 as const, images } });
          }
          sendResponse({ ok: true });
        } catch (err) {
          console.error("[QA Feedback] QAF_PERSIST_PENDING_IMAGES:", err);
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === "OPEN_OPTIONS") {
      try {
        chrome.runtime.openOptionsPage(() => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.error("[QA Feedback] openOptionsPage:", err.message);
            sendResponse({ ok: false });
          } else {
            sendResponse({ ok: true });
          }
        });
      } catch (err) {
        console.error("[QA Feedback] openOptionsPage:", err);
        sendResponse({ ok: false });
      }
      return true;
    }

    if (message.type === "LIST_REPO_TARGETS") {
      void (async () => {
        try {
          const s = await loadSettings();
          const jiraTokenConfigured = Boolean(s.jiraApiToken?.trim());
          const base: Record<string, unknown> = {
            repos: repoTargetsForUi(s),
            githubTokenConfigured: Boolean(s.githubToken?.trim()),
            jiraTokenConfigured,
            fullNetworkDiagnostic: Boolean(s.fullNetworkDiagnostic),
            captureMode: s.captureMode ?? "debug-interno",
            enableViewportRecording: Boolean(s.enableViewportRecording),
            viewportRecordingMaxSec: s.viewportRecordingMaxSec ?? 60,
          };
          if (jiraTokenConfigured) {
            const jb = await listFilteredJiraBoardsForFeedback(s);
            if (jb.ok) {
              base.jiraBoards = jb.boards;
              if (jb.defaultBoardId) base.jiraDefaultBoardId = jb.defaultBoardId;
            } else {
              base.jiraBoards = [];
              base.jiraBoardsError = jb.message;
            }
          }
          sendResponse(base);
        } catch (err) {
          console.error("[QA Feedback] LIST_REPO_TARGETS:", err);
          sendResponse({
            repos: [],
            githubTokenConfigured: false,
            jiraTokenConfigured: false,
            fullNetworkDiagnostic: false,
            captureMode: "debug-interno",
            enableViewportRecording: false,
            viewportRecordingMaxSec: 60,
            loadFailed: true,
          });
        }
      })();
      return true;
    }

    if (message.type === "TEST_GITHUB") {
      void (async () => {
        const s = await loadSettings();
        const token = (message.token ?? s.githubToken).trim();
        const r = await testTokenAndListRepos(token);
        sendResponse(r);
      })();
      return true;
    }

    if (message.type === "TEST_JIRA") {
      void (async () => {
        const s = await loadSettings();
        const r = await testJiraConnection({
          siteUrl: s.jiraSiteUrl ?? "",
          email: s.jiraEmail ?? "",
          apiToken: s.jiraApiToken ?? "",
        });
        sendResponse(r);
      })();
      return true;
    }

    if (message.type === "JIRA_TEST_AND_LIST_BOARDS") {
      void (async () => {
        const s = await loadSettings();
        const m = message as JiraTestAndListBoardsMessage;
        const siteUrl = (m.jiraSiteUrl ?? s.jiraSiteUrl ?? "").trim();
        const email = (m.jiraEmail ?? s.jiraEmail ?? "").trim();
        const apiToken = (m.jiraApiToken ?? s.jiraApiToken ?? "").trim();
        const boardIdStr = (m.jiraSoftwareBoardId ?? s.jiraSoftwareBoardId ?? "").trim();

        const conn = await testJiraConnection({
          siteUrl,
          email,
          apiToken,
        });
        if (!conn.ok) {
          sendResponse(conn);
          return;
        }

        /** Sem quadro escolhido: lista todos os quadros acessíveis (como na UI de opções). */
        let boardListProjectKey = "";
        const bid = Number.parseInt(boardIdStr, 10);
        let boardResolveWarning: string | undefined;
        let resolvedProjectKey: string | undefined;
        let projectKeyForFilter = "";

        if (Number.isFinite(bid) && bid > 0) {
          const fb = await fetchJiraSoftwareBoard({
            siteUrl,
            email,
            apiToken,
            boardId: bid,
          });
          if (fb.ok) {
            boardListProjectKey = fb.board.projectKey;
            projectKeyForFilter = fb.board.projectKey;
            resolvedProjectKey = fb.board.projectKey;
          } else {
            boardResolveWarning = `Quadro ${bid}: ${fb.message}`;
          }
        }

        const lb = await listJiraBoards({
          siteUrl,
          email,
          apiToken,
          projectKey: boardListProjectKey,
        });
        if (!lb.ok) {
          sendResponse({ ok: false, message: lb.message, status: lb.status });
          return;
        }

        let boardFilterPreview:
          | Awaited<ReturnType<typeof resolveJiraBoardFieldsForIssueCreate>>
          | undefined;
        if (Number.isFinite(bid) && bid > 0 && projectKeyForFilter) {
          boardFilterPreview = await resolveJiraBoardFieldsForIssueCreate({
            baseUrl: conn.baseUrl,
            email,
            apiToken,
            boardId: bid,
            projectKey: projectKeyForFilter,
            issueTypeName: (s.jiraIssueTypeName ?? "Bug").trim() || "Bug",
          });
        }

        sendResponse({
          ok: true,
          displayName: conn.displayName,
          resolvedSiteUrl: conn.baseUrl,
          resolvedProjectKey,
          boardResolveWarning,
          boards: lb.boards,
          boardFilterPreview,
        });
      })();
      return true;
    }

    if (message.type === "START_NETWORK_DIAGNOSTIC") {
      void (async () => {
        try {
          const s = await loadSettings();
          if (!s.fullNetworkDiagnostic) {
            sendResponse({ ok: true, active: false });
            return;
          }
          const tabId = sender.tab?.id;
          if (tabId == null) {
            sendResponse({ ok: false, message: "Aba desconhecida.", active: false });
            return;
          }
          const tab = await chrome.tabs.get(tabId);
          const pageUrl = tab.url ?? tab.pendingUrl ?? "";
          if (!urlMatchesAllowedHosts(pageUrl, s.allowedHosts)) {
            sendResponse({ ok: true, active: false });
            return;
          }
          const r = await startNetworkDiagnosticForTab(tabId);
          sendResponse({ ok: r.ok, message: r.message, active: r.active });
        } catch (err) {
          console.error("[QA Feedback] START_NETWORK_DIAGNOSTIC:", err);
          sendResponse({
            ok: false,
            message: err instanceof Error ? err.message : "Falha ao iniciar captura.",
            active: false,
          });
        }
      })();
      return true;
    }

    if (message.type === "STOP_NETWORK_DIAGNOSTIC") {
      void (async () => {
        try {
          const tabId = sender.tab?.id;
          if (tabId != null) await stopNetworkDiagnosticForTab(tabId);
          sendResponse({ ok: true });
        } catch (err) {
          console.error("[QA Feedback] STOP_NETWORK_DIAGNOSTIC:", err);
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === "CAPTURE_VISIBLE_TAB") {
      void (async () => {
        const m = message as CaptureVisibleTabMessage;
        let windowId = sender.tab?.windowId;
        if (windowId == null && typeof m.tabId === "number") {
          try {
            const t = await chrome.tabs.get(m.tabId);
            windowId = t.windowId;
          } catch {
            /* ignore */
          }
        }
        if (windowId == null) {
          sendResponse({ ok: false, message: "Separador desconhecido." });
          return;
        }
        /**
         * API: `captureVisibleTab(windowId, options)` — o 1.º argumento é o ID da **janela**,
         * não o da aba. O content script pode enviar `tabId` para resolver `windowId` se `sender.tab` falhar.
         */
        try {
          const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
          if (!dataUrl) {
            sendResponse({ ok: false, message: "Captura vazia." });
            return;
          }
          sendResponse({ ok: true, dataUrl });
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : chrome.runtime.lastError?.message ?? "Falha ao capturar o separador.";
          sendResponse({ ok: false, message: msg });
        }
      })();
      return true;
    }

    if (message.type === "QAF_TIMELINE_SESSION_START") {
      void (async () => {
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: false });
          return;
        }
        const m = message as QafTimelineSessionStartMessage;
        const sid =
          (m.sessionId && String(m.sessionId).trim()) ||
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `qaf-${Date.now()}`);
        await timelineSessionStart(tabId, sid);
        sendResponse({ ok: true as const, sessionId: sid });
      })();
      return true;
    }

    if (message.type === "QAF_TIMELINE_APPEND") {
      void (async () => {
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: false });
          return;
        }
        const m = message as QafTimelineAppendMessage;
        const entries = Array.isArray(m.entries) ? m.entries : [];
        await timelineSessionAppend(tabId, entries);
        sendResponse({ ok: true as const });
      })();
      return true;
    }

    if (message.type === "QAF_TIMELINE_GET_FOR_SUBMIT") {
      void (async () => {
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: false as const, entries: [] });
          return;
        }
        const entries = await timelineSessionGetForSubmit(tabId);
        sendResponse({ ok: true as const, entries });
      })();
      return true;
    }

    if (message.type === "QAF_TIMELINE_SESSION_END") {
      void (async () => {
        const tabId = sender.tab?.id;
        if (tabId == null) {
          sendResponse({ ok: false });
          return;
        }
        await timelineSessionEnd(tabId);
        sendResponse({ ok: true as const });
      })();
      return true;
    }

    if (message.type === "CREATE_ISSUE") {
      void (async () => {
        const s = await loadSettings();
        const p = message.payload;
        const tabId = sender.tab?.id;
        const wantGh = Boolean(p.sendToGitHub);
        const wantJi = Boolean(p.sendToJira);

        if (!wantGh && !wantJi) {
          sendResponse({ ok: false, message: "Selecione GitHub e/ou Jira como destino." });
          return;
        }

        const warnings: string[] = [];
        let githubUrl: string | undefined;
        let jiraUrl: string | undefined;
        let jiraIssueBrowseUrl: string | undefined;
        /** ID de quadro efetivo no Jira após validação (para resposta ao modal). */
        let jiraBoardIdUsedForResponse: string | undefined;

        if (wantGh) {
          if (!s.githubToken.trim()) {
            sendResponse({ ok: false, message: "Configure o token GitHub nas opções ou desmarque GitHub." });
            return;
          }
          const targets = resolveRepoTargets(s);
          if (targets.length === 0) {
            sendResponse({
              ok: false,
              message: "Configure ao menos um repositório nas opções ou desmarque GitHub.",
            });
            return;
          }

          let owner = message.owner?.trim();
          let repo = message.repo?.trim();

          if (owner && repo) {
            if (!isAllowedRepoTarget(s, owner, repo)) {
              sendResponse({ ok: false, message: "Repositório selecionado não está na lista permitida." });
              return;
            }
          } else {
            owner = targets[0].owner;
            repo = targets[0].repo;
          }

          const n = normalizeGitHubRepoRef(owner, repo);
          if (!n.owner || !n.repo) {
            sendResponse({ ok: false, message: "Owner/repositório inválido." });
            return;
          }

          const r = await createGitHubIssue({
            token: s.githubToken,
            owner: n.owner,
            repo: n.repo,
            payload: p,
          });
          if (r.ok) githubUrl = r.htmlUrl;
          else warnings.push(`GitHub: ${r.message}`);
        }

        if (wantJi) {
          const jiraBase = resolveJiraCloudBaseUrl(s.jiraSiteUrl ?? "", s.jiraEmail ?? "");
          if (!jiraBase || !s.jiraEmail?.trim() || !s.jiraApiToken?.trim()) {
            if (wantGh && githubUrl) {
              sendResponse({
                ok: true,
                githubUrl,
                warnings: [
                  "Jira: configure email @empresa + API token (e ID do quadro) nas opções ou desmarque Jira.",
                ],
              });
              return;
            }
            sendResponse({
              ok: false,
              message:
                "Configure Jira nas opções (email @empresa + API token + ID do quadro, ou site em Avançado) ou desmarque Jira.",
            });
            return;
          }

          if (!isJiraMotivoAbertura(p.jiraMotivoAbertura)) {
            sendResponse({
              ok: false,
              message: "Selecione o motivo da abertura (Jira).",
            });
            return;
          }

          const createMsg = message as CreateIssueMessage;
          /** ID no `payload` (modal) tem prioridade; top-level mantém compatibilidade. */
          const requestedBoardId =
            coerceJiraBoardIdRequest(p.jiraSoftwareBoardId) ||
            coerceJiraBoardIdRequest(createMsg.jiraSoftwareBoardId) ||
            undefined;
          const boardPick = await resolveJiraBoardIdForCreate(s, requestedBoardId);
          if (!boardPick.ok) {
            sendResponse({ ok: false, message: boardPick.message });
            return;
          }
          const effectiveJiraBoardId = boardPick.boardIdStr;
          console.info(
            "[QA Feedback] CREATE_ISSUE Jira board",
            JSON.stringify({
              requestedBoardId: requestedBoardId ?? null,
              effectiveJiraBoardId,
              usedExplicitSelection: boardPick.usedExplicitSelection,
            }),
          );
          /** Overrides de filtro guardados nas opções só fazem sentido para o quadro «padrão»; outro quadro no modal evita sobrescrever o JQL certo. */
          const storageBoardId = (s.jiraSoftwareBoardId ?? "").trim();
          const boardMatchesSavedOptions =
            !storageBoardId || effectiveJiraBoardId === storageBoardId;

          let appendHarHelp: string | undefined;
          const jiraAttachments = [...(p.jiraImageAttachments ?? [])];
          if (s.fullNetworkDiagnostic && tabId != null) {
            try {
              const tabForHar = await chrome.tabs.get(tabId);
              const harUrl = tabForHar.url ?? tabForHar.pendingUrl ?? "";
              if (urlMatchesAllowedHosts(harUrl, s.allowedHosts)) {
                const har = await consumeNetworkHarForTab(tabId);
                if (har) {
                  jiraAttachments.push({
                    fileName: har.fileName,
                    mimeType: "application/json",
                    base64: har.base64,
                  });
                  appendHarHelp = networkHarJiraDescriptionMarkdown(har.fileName);
                }
              }
            } catch (e) {
              warnings.push(
                `HAR rede: ${e instanceof Error ? e.message : "falha ao gerar anexo"}.`,
              );
            }
          }

          const jr = await createJiraIssue({
            siteUrl: s.jiraSiteUrl ?? "",
            email: s.jiraEmail ?? "",
            apiToken: s.jiraApiToken ?? "",
            projectKey: s.jiraProjectKey ?? "",
            issueTypeName: s.jiraIssueTypeName ?? "Bug",
            payload: p,
            motivoAbertura: p.jiraMotivoAbertura,
            motivoCustomFieldId: s.jiraMotivoCustomFieldId,
            jiraSoftwareBoardId: effectiveJiraBoardId,
            jiraBoardAutoFields: boardMatchesSavedOptions ? s.jiraBoardAutoFields : undefined,
            jiraBoardFilterSelectFieldId: boardMatchesSavedOptions
              ? s.jiraBoardFilterSelectFieldId
              : undefined,
            jiraBoardFilterSelectValue: boardMatchesSavedOptions
              ? s.jiraBoardFilterSelectValue
              : undefined,
            appendDescriptionMarkdown: appendHarHelp,
          });
          if (jr.ok) {
            if (jiraAttachments.length > 0) {
              const up = await uploadJiraIssueAttachments({
                baseUrl: jiraBase,
                email: s.jiraEmail ?? "",
                apiToken: s.jiraApiToken ?? "",
                issueKey: jr.key,
                attachments: jiraAttachments,
              });
              if (!up.ok) warnings.push(`Jira anexos: ${up.message}`);
            }

            const browse = jr.htmlUrl;
            const issueProjectKey =
              (s.jiraProjectKey ?? "").trim() ||
              (jr.key.match(/^([A-Z][A-Z0-9_]*)-\d+$/i)?.[1]?.toUpperCase() ?? "");
            const boardLink = jiraResolvedBoardWebUrl({
              siteUrl: jiraBase,
              projectKey: issueProjectKey,
              jiraSoftwareBoardId: effectiveJiraBoardId,
              selectedIssueKey: jr.key,
            });
            jiraUrl = boardLink ?? browse;
            jiraIssueBrowseUrl = boardLink ? browse : undefined;
            jiraBoardIdUsedForResponse = effectiveJiraBoardId;
            if (jr.warning) warnings.push(jr.warning);
          } else {
            warnings.push(`Jira: ${jr.message}`);
          }
        }

        if (!githubUrl && !jiraUrl) {
          sendResponse({
            ok: false,
            message: warnings.join(" ") || "Não foi possível criar em nenhum destino.",
          });
          return;
        }

        sendResponse({
          ok: true,
          githubUrl,
          jiraUrl,
          jiraIssueBrowseUrl,
          ...(jiraBoardIdUsedForResponse
            ? { jiraSoftwareBoardIdUsed: jiraBoardIdUsedForResponse }
            : {}),
          warnings: warnings.length ? warnings : undefined,
        });
      })();
      return true;
    }

    return undefined;
  },
);

scheduleRefreshContentScripts();
