import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CreateIssuePayload, IssueFormState, JiraImageAttachmentPayload } from "../shared/types";
import {
  fileToBase64,
  JIRA_FEEDBACK_MAX_IMAGE_BYTES,
  JIRA_FEEDBACK_MAX_IMAGES,
  safeImageFileNameForJira,
} from "../shared/feedback-image-utils";
import { pickSpeechRecognitionLang } from "../shared/chrome-speech-dictation";
import { detectDictationPlatform, getDictationMicTooltip } from "../shared/native-dictation-hint";
import { buildIssueBody } from "../shared/issue-builder";
import {
  buildTechnicalContext,
  ensurePageBridgeInjected,
  readBridgeSnapshot,
} from "../shared/context-collector";
import { shadowCss } from "./shadow-styles";
import {
  elementIsInsideExtensionUi,
  eventPathTouchesExtensionUi,
} from "../shared/extension-constants";
import {
  isExtensionContextInvalidatedError,
  tryGetExtensionResourceUrl,
} from "../shared/extension-runtime";
import { JIRA_MOTIVO_ABERTURA_OPTIONS, isJiraMotivoAbertura } from "../shared/jira-motivo";
import { titleFromDescription } from "../shared/title-from-description";
import { useChromeSpeechDictation } from "./useChromeSpeechDictation";
import { runRegionScreenshotFlow } from "../content/region-screenshot-flow";

type Tab = "form" | "preview";

type RepoOption = { owner: string; repo: string; label: string };

type PendingFeedbackImage = { id: string; file: File; url: string };

const FEEDBACK_ICON_URL = tryGetExtensionResourceUrl("qa.png");

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

function MicIcon() {
  return (
    <svg
      className="qaf-dictation-mic-svg"
      viewBox="0 0 24 24"
      width={20}
      height={20}
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v5c0 1.1.9 2 2 2zm5-2c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
      />
    </svg>
  );
}

/** Ícone do FAB: `public/qa.png` (`npm run icons` — máscara circular sobre `PRD/capiQA.png`). */
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

export function FeedbackApp() {
  const [minimized, setMinimized] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("form");
  const [form, setForm] = useState<IssueFormState>(initialForm);
  const [lastTarget, setLastTarget] = useState<Element | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postSubmit, setPostSubmit] = useState<{
    github?: string;
    jira?: string;
    /** Só quando `jira` aponta ao quadro: link /browse/KEY */
    jiraIssueBrowse?: string;
    warnings?: string[];
  } | null>(null);
  const [repoTargets, setRepoTargets] = useState<RepoOption[]>([]);
  const [repoIndex, setRepoIndex] = useState(0);
  /** Tokens guardados nas opções: controlam destinos visíveis no modal. */
  const [githubTokenConfigured, setGithubTokenConfigured] = useState(false);
  const [jiraTokenConfigured, setJiraTokenConfigured] = useState(false);
  /** null = OK; context = extensão recarregada — precisa F5; other = falha de mensagem; loadFailed = erro no SW ao ler storage */
  const [repoListIssue, setRepoListIssue] = useState<null | "context" | "other" | "loadFailed">(null);
  /** Opção nas definições: captura HAR com o modal aberto. */
  const [fullNetworkDiagnosticEnabled, setFullNetworkDiagnosticEnabled] = useState(false);
  const [networkDiagError, setNetworkDiagError] = useState<string | null>(null);
  const [regionScreenshotBusy, setRegionScreenshotBusy] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingFeedbackImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  } = useChromeSpeechDictation(setForm, getFormSnapshot, { enabled: open });

  useEffect(() => {
    ensurePageBridgeInjected();
  }, []);

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
    if (!jiraTokenConfigured || !form.sendToJira) return;
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
  }, [addImageFiles, form.sendToJira, jiraTokenConfigured, pendingImages.length]);

  const loadRepoTargets = useCallback(async () => {
    setRepoListIssue(null);
    try {
      const r = (await chrome.runtime.sendMessage({ type: "LIST_REPO_TARGETS" })) as {
        repos?: RepoOption[];
        githubTokenConfigured?: boolean;
        jiraTokenConfigured?: boolean;
        fullNetworkDiagnostic?: boolean;
        loadFailed?: boolean;
      };
      if (r && "loadFailed" in r && r.loadFailed) {
        setRepoTargets([]);
        setRepoIndex(0);
        setGithubTokenConfigured(false);
        setJiraTokenConfigured(false);
        setFullNetworkDiagnosticEnabled(false);
        setRepoListIssue("loadFailed");
        return;
      }
      const list = Array.isArray(r?.repos) ? r.repos : [];
      const ghOk = Boolean(r?.githubTokenConfigured);
      const jiraOk = Boolean(r?.jiraTokenConfigured);
      setFullNetworkDiagnosticEnabled(Boolean(r?.fullNetworkDiagnostic));
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
      setRepoIndex(0);
    } catch (e) {
      setRepoTargets([]);
      setRepoIndex(0);
      setGithubTokenConfigured(false);
      setJiraTokenConfigured(false);
      setFullNetworkDiagnosticEnabled(false);
      setRepoListIssue(isExtensionContextInvalidatedError(e) ? "context" : "other");
    }
  }, []);

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

  const payload = useMemo((): CreateIssuePayload => {
    const bridge = readBridgeSnapshot();
    const target =
      lastTarget && !elementIsInsideExtensionUi(lastTarget) ? lastTarget : null;
    const technicalContext = form.includeTechnicalContext
      ? buildTechnicalContext({ lastTarget: target, bridge })
      : undefined;
    return { ...form, technicalContext };
  }, [form, lastTarget]);

  const previewMd = useMemo(() => buildIssueBody(payload), [payload]);

  const selectedRepo = repoTargets[repoIndex];
  const hasAnyDestination = githubTokenConfigured || jiraTokenConfigured;
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
    setPendingImages((prev) => {
      for (const x of prev) URL.revokeObjectURL(x.url);
      return [];
    });
    setForm(destinationDefaults(githubTokenConfigured, jiraTokenConfigured));
    setError(null);
    setPostSubmit(null);
    setTab("form");
  };

  const closeModal = () => {
    setOpen(false);
    resetFlow();
  };

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

      const res = (await chrome.runtime.sendMessage({
        type: "CREATE_ISSUE",
        payload: {
          ...payload,
          ...(jiraImageAttachments?.length ? { jiraImageAttachments } : {}),
        },
        owner: selectedRepo?.owner,
        repo: selectedRepo?.repo,
      })) as {
        ok: boolean;
        message?: string;
        githubUrl?: string;
        jiraUrl?: string;
        jiraIssueBrowseUrl?: string;
        warnings?: string[];
      };

      if (res && res.ok && (res.githubUrl || res.jiraUrl)) {
        setPostSubmit({
          github: res.githubUrl,
          jira: res.jiraUrl,
          jiraIssueBrowse: res.jiraIssueBrowseUrl,
          warnings: res.warnings,
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

  const handleWhatHappenedChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, whatHappened: v, title: titleFromDescription(v) }));
  };

  const openModal = useCallback(() => {
    setOpen(true);
    setError(null);
    setPostSubmit(null);
    setTab("form");
  }, []);

  return (
    <>
      <style>{shadowCss}</style>
      <div className="qaf-wrap">
        {!minimized ? (
          <>
            <button
              type="button"
              className="qaf-fab qaf-fab-icon-only"
              onClick={openModal}
              aria-label="Abrir feedback"
            >
              <FeedbackFabIcon />
            </button>
            <button type="button" className="qaf-link" onClick={() => setMinimized(true)}>
              Minimizar
            </button>
          </>
        ) : (
          <div className="qaf-mini-actions">
            <button
              type="button"
              className="qaf-fab qaf-fab-icon-only"
              title="Abrir feedback"
              aria-label="Restaurar botão de feedback"
              onClick={() => setMinimized(false)}
            >
              <FeedbackFabIcon />
            </button>
          </div>
        )}
      </div>

      {open && (
        <>
          <button type="button" className="qaf-backdrop" aria-label="Fechar" onClick={closeModal} />
          <div className="qaf-modal" role="dialog" aria-modal="true" aria-labelledby="qaf-dlg-title">
            <div className="qaf-modal-header">
              <div className="qaf-modal-header-brand">
                <div className="qaf-modal-avatar">
                  <FeedbackFabIcon />
                </div>
                <div className="qaf-modal-header-text">
                  <h2 className="qaf-modal-title" id="qaf-dlg-title">
                    RA Inspector
                  </h2>
                  <p className="qaf-modal-subtitle">
                    {!hasAnyDestination ? (
                      <>
                        Configure o token do <strong>GitHub</strong> e/ou do <strong>Jira</strong> nas opções para
                        enviar o relatório por API.
                      </>
                    ) : (
                      <>
                        Ferramenta de QA do Reclame AQUI — envie para{" "}
                        {githubTokenConfigured && jiraTokenConfigured ? (
                          <>
                            <strong>GitHub</strong>, <strong>Jira</strong> ou ambos
                          </>
                        ) : githubTokenConfigured ? (
                          <strong>GitHub</strong>
                        ) : (
                          <strong>Jira</strong>
                        )}
                        .
                      </>
                    )}
                  </p>
                  <button type="button" className="qaf-modal-settings-link" onClick={openOptions}>
                    Configurações
                  </button>
                </div>
              </div>
              <div className="qaf-modal-header-actions">
                <button
                  type="button"
                  className="qaf-modal-icon-btn"
                  onClick={openOptions}
                  aria-label="Abrir configurações"
                  title="Configurações"
                >
                  ⚙
                </button>
                <button type="button" className="qaf-modal-close" onClick={closeModal} aria-label="Fechar">
                  ×
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

            <div className="qaf-body">
              {fullNetworkDiagnosticEnabled && !postSubmit ? (
                networkDiagError ? (
                  <div className="qaf-network-diag qaf-network-diag--error" role="alert">
                    <strong>Captura de rede:</strong> {networkDiagError}
                  </div>
                ) : (
                  <div className="qaf-network-diag" role="status">
                    <strong>Modo diagnóstico:</strong> a registar pedidos HTTP desta aba; ao enviar ao{" "}
                    <strong>Jira</strong> pode anexar-se um arquivo HAR. Se isto falhar, feche o{" "}
                    <strong>DevTools nesta aba</strong> e reabra o feedback.
                  </div>
                )
              ) : null}
              {postSubmit ? (
                <div className="qaf-success">
                  <div className="qaf-success-hero">
                    <div className="qaf-success-check" aria-hidden>
                      ✓
                    </div>
                    <h3 className="qaf-success-title">Evidência criada</h3>
                  </div>
                  <div className="qaf-success-cards">
                    {postSubmit.github ? (
                      <div className="qaf-success-card">
                        <div className="qaf-success-card-head">GitHub</div>
                        <div className="qaf-success-card-actions">
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                            onClick={() => copyText(postSubmit.github!)}
                          >
                            <CopyIcon /> Copiar
                          </button>
                          <a
                            className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                            href={postSubmit.github}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Acessar
                          </a>
                        </div>
                      </div>
                    ) : null}
                    {postSubmit.jira ? (
                      <div className="qaf-success-card">
                        <div className="qaf-success-card-head">Jira Board</div>
                        <div className="qaf-success-card-actions">
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                            onClick={() => copyText(postSubmit.jira!)}
                          >
                            <CopyIcon /> Copiar
                          </button>
                          <a
                            className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                            href={postSubmit.jira}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Acessar
                          </a>
                        </div>
                      </div>
                    ) : null}
                    {postSubmit.jiraIssueBrowse ? (
                      <div className="qaf-success-card">
                        <div className="qaf-success-card-head">Jira Issue</div>
                        <div className="qaf-success-card-actions">
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                            onClick={() => copyText(postSubmit.jiraIssueBrowse!)}
                          >
                            <CopyIcon /> Copiar
                          </button>
                          <a
                            className="qaf-btn qaf-btn-secondary qaf-btn-sm"
                            href={postSubmit.jiraIssueBrowse}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Acessar
                          </a>
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
                  <div className="qaf-footer-eq">
                    <div className="qaf-footer-eq-row">
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
                      A escutar na descrição… clique no microfone outra vez para parar.
                    </div>
                  ) : null}

                  {tab === "form" ? (
                    <>
                      {!hasAnyDestination ? (
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
                      ) : githubTokenConfigured ? (
                        <p className="qaf-dest-hint">
                          Destino: <strong>GitHub</strong> (token configurado).
                        </p>
                      ) : (
                        <p className="qaf-dest-hint">
                          Destino: <strong>Jira Cloud</strong> (token configurado).
                        </p>
                      )}
                      {form.sendToJira && (
                        <div className="qaf-field" role="radiogroup" aria-labelledby="qaf-motivo-label">
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
                          <label className="qaf-label" htmlFor="qaf-title-ro">
                            Título <span className="qaf-required">*</span>
                          </label>
                          <input
                            id="qaf-title-ro"
                            className="qaf-input qaf-input--readonly"
                            readOnly
                            tabIndex={-1}
                            value={form.title}
                            title="Gerado automaticamente das quatro primeiras palavras da descrição"
                            aria-readonly="true"
                          />
                          <p className="qaf-img-hint" style={{ marginTop: 4 }}>
                            Preenchido com as quatro primeiras palavras do texto abaixo (digitação ou ditado).
                          </p>
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
                            onChange={handleWhatHappenedChange}
                            onPaste={(e) => {
                              if (!jiraTokenConfigured || !form.sendToJira) return;
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
                      {jiraTokenConfigured && form.sendToJira ? (
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
                                className="qaf-btn-ghost"
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
                              Até {JIRA_FEEDBACK_MAX_IMAGES} imagens, {JIRA_FEEDBACK_MAX_IMAGE_BYTES / (1024 * 1024)} MB
                              cada. «Capturar área» esconde o botão de feedback, permite arrastar um retângulo na página
                              visível e anexa o recorte. Colar captura (Ctrl+V) também funciona.
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
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-submit"
                            disabled={!canSubmit || busy}
                            onClick={submit}
                          >
                            {busy ? "Enviando…" : "Enviar"}
                          </button>
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-secondary"
                            onClick={() => copyText(previewMd)}
                          >
                            <CopyIcon /> Copiar
                          </button>
                          <button type="button" className="qaf-btn qaf-btn-secondary" onClick={closeModal}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="qaf-preview">{previewMd || "(vazio)"}</div>
                      <div className="qaf-footer-eq">
                        <div className="qaf-footer-eq-row">
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-submit"
                            disabled={!canSubmit || busy}
                            onClick={submit}
                          >
                            {busy ? "Enviando…" : "Enviar"}
                          </button>
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-secondary"
                            onClick={() => copyText(previewMd)}
                          >
                            <CopyIcon /> Copiar
                          </button>
                          <button type="button" className="qaf-btn qaf-btn-secondary" onClick={closeModal}>
                            Cancelar
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
    </>
  );
}
