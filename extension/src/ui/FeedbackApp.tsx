import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreateIssuePayload, IssueFormState } from "../shared/types";
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

type Tab = "form" | "preview";

type RepoOption = { owner: string; repo: string; label: string };

const FEEDBACK_ICON_URL = tryGetExtensionResourceUrl("qa.png");

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

const initialForm = (): IssueFormState => ({
  title: "",
  whatHappened: "",
  includeTechnicalContext: true,
});

export function FeedbackApp() {
  const [minimized, setMinimized] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("form");
  const [form, setForm] = useState<IssueFormState>(initialForm);
  const [lastTarget, setLastTarget] = useState<Element | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);
  const [repoTargets, setRepoTargets] = useState<RepoOption[]>([]);
  const [repoIndex, setRepoIndex] = useState(0);
  /** null = OK; context = extensão recarregada — precisa F5; other = falha de mensagem; loadFailed = erro no SW ao ler storage */
  const [repoListIssue, setRepoListIssue] = useState<null | "context" | "other" | "loadFailed">(null);

  useEffect(() => {
    ensurePageBridgeInjected();
  }, []);

  const loadRepoTargets = useCallback(async () => {
    setRepoListIssue(null);
    try {
      const r = (await chrome.runtime.sendMessage({ type: "LIST_REPO_TARGETS" })) as {
        repos?: RepoOption[];
        loadFailed?: boolean;
      };
      if (r && "loadFailed" in r && r.loadFailed) {
        setRepoTargets([]);
        setRepoIndex(0);
        setRepoListIssue("loadFailed");
        return;
      }
      const list = Array.isArray(r?.repos) ? r.repos : [];
      setRepoTargets(list);
      setRepoIndex(0);
    } catch (e) {
      setRepoTargets([]);
      setRepoIndex(0);
      setRepoListIssue(isExtensionContextInvalidatedError(e) ? "context" : "other");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadRepoTargets();
  }, [open, loadRepoTargets]);

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
  const canSubmit =
    form.title.trim().length > 0 &&
    form.whatHappened.trim().length > 0 &&
    !!selectedRepo;

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
    setForm(initialForm());
    setError(null);
    setIssueUrl(null);
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
      const res = (await chrome.runtime.sendMessage({
        type: "CREATE_ISSUE",
        payload,
        owner: selectedRepo?.owner,
        repo: selectedRepo?.repo,
      })) as { ok: boolean; message?: string; htmlUrl?: string };

      if (res && "ok" in res && res.ok && res.htmlUrl) {
        setIssueUrl(res.htmlUrl);
      } else {
        setError((res as { message?: string }).message ?? "Falha ao criar issue.");
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
    setOpen(true);
    setError(null);
    setIssueUrl(null);
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
              aria-label="Abrir feedback — criar issue no GitHub"
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
              <div className="qaf-modal-header-text">
                <h2 className="qaf-modal-title" id="qaf-dlg-title">
                  Enviar feedback
                </h2>
                <p className="qaf-modal-subtitle">
                  Envie o relatório como issue no GitHub. Descreva o que gostaria de ver alterado ou relate um problema.
                </p>
                <button type="button" className="qaf-modal-settings-link" onClick={openOptions}>
                  Configurações
                </button>
              </div>
              <button type="button" className="qaf-modal-close" onClick={closeModal} aria-label="Fechar">
                ×
              </button>
            </div>

            {!issueUrl && (
              <div className="qaf-repo-bar qaf-field">
                <label className="qaf-label" htmlFor="qaf-repo">
                  Repositório destino
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

            {!issueUrl && (
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
              {issueUrl ? (
                <div className="qaf-success">
                  <div>Issue criada com sucesso.</div>
                  <p>
                    <a href={issueUrl} target="_blank" rel="noreferrer">
                      Abrir no GitHub
                    </a>
                  </p>
                  <div className="qaf-actions-row qaf-success-actions">
                    <div className="qaf-actions-left">
                      <button type="button" className="qaf-btn qaf-btn-text" onClick={() => copyText(issueUrl)}>
                        Copiar URL
                      </button>
                    </div>
                    <div className="qaf-actions-right">
                      <button type="button" className="qaf-btn qaf-btn-secondary" onClick={closeModal}>
                        Fechar
                      </button>
                      <button type="button" className="qaf-btn qaf-btn-submit" onClick={resetFlow}>
                        Novo feedback
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {error && <div className="qaf-error">{error}</div>}

                  {tab === "form" ? (
                    <>
                      <div className="qaf-field">
                        <label className="qaf-label" htmlFor="qaf-title">
                          Título <span className="qaf-required">*</span>
                        </label>
                        <input
                          id="qaf-title"
                          className="qaf-input"
                          value={form.title}
                          onChange={onField("title")}
                          placeholder="Resumo curto do problema"
                        />
                      </div>
                      <div className="qaf-field">
                        <label className="qaf-label" htmlFor="qaf-what">
                          O que aconteceu <span className="qaf-required">*</span>
                        </label>
                        <textarea
                          id="qaf-what"
                          className="qaf-textarea"
                          value={form.whatHappened}
                          onChange={onField("whatHappened")}
                          placeholder="Descreva o comportamento observado"
                        />
                      </div>
                      <label className="qaf-check">
                        <input
                          type="checkbox"
                          checked={form.includeTechnicalContext}
                          onChange={onField("includeTechnicalContext")}
                        />
                        <span className="qaf-check-text">
                          <span className="qaf-check-title">Incluir contexto técnico</span>
                          <span className="qaf-check-hint">
                            URL, viewport, último clique na página (não no botão), console e requests com falha.
                          </span>
                        </span>
                      </label>
                      <div className="qaf-actions-row">
                        <div className="qaf-actions-left">
                          <button type="button" className="qaf-btn qaf-btn-text" onClick={() => copyText(previewMd)}>
                            Copiar markdown
                          </button>
                        </div>
                        <div className="qaf-actions-right">
                          <button type="button" className="qaf-btn qaf-btn-secondary" onClick={closeModal}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-submit"
                            disabled={!canSubmit || busy}
                            onClick={submit}
                          >
                            {busy ? "Enviando…" : "Criar issue"}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="qaf-preview">{previewMd || "(vazio)"}</div>
                      <div className="qaf-actions-row">
                        <div className="qaf-actions-left">
                          <button type="button" className="qaf-btn qaf-btn-text" onClick={() => copyText(previewMd)}>
                            Copiar markdown
                          </button>
                        </div>
                        <div className="qaf-actions-right">
                          <button type="button" className="qaf-btn qaf-btn-secondary" onClick={closeModal}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="qaf-btn qaf-btn-submit"
                            disabled={!canSubmit || busy}
                            onClick={submit}
                          >
                            {busy ? "Enviando…" : "Criar issue"}
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
