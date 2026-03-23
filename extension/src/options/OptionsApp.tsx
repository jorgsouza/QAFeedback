import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  DEFAULT_ALLOWED_HOSTS,
  emptySettings,
  loadSettings,
  saveSettings,
} from "../shared/storage";
import type { ExtensionSettings } from "../shared/types";
import {
  normalizeAllowedHostLine,
  normalizeGitHubRepoRef,
} from "../shared/github-repo-normalize";
import { matchPatternsForAllowedHost } from "../shared/host-patterns";
import {
  formatReposForTextarea,
  parseReposTextarea,
  resolveRepoTargets,
} from "../shared/repo-targets";
import { iaOriginPatternFromBaseUrl } from "../shared/ia-service";

function hostsToText(hosts: string[]): string {
  return hosts.join("\n");
}

function textToHosts(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function originPatternsForHosts(hosts: string[]): string[] {
  const patterns: string[] = [];
  for (const h of hosts) {
    patterns.push(...matchPatternsForAllowedHost(h));
  }
  return [...new Set(patterns)];
}

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(emptySettings());
  const [reposText, setReposText] = useState("");
  const [hostsText, setHostsText] = useState(hostsToText(DEFAULT_ALLOWED_HOSTS));
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      setSettings(s);
      setReposText(formatReposForTextarea(resolveRepoTargets(s)));
      setHostsText(hostsToText(s.allowedHosts));
      setLoaded(true);
    })();
  }, []);

  const onSave = useCallback(async () => {
    setStatus(null);
    const repos = parseReposTextarea(reposText);
    if (repos.length === 0) {
      setStatus("Adicione ao menos um repositório (uma linha: owner/repo ou URL do GitHub).");
      return;
    }

    const hosts = [
      ...new Set(
        textToHosts(hostsText)
          .map(normalizeAllowedHostLine)
          .filter(Boolean),
      ),
    ];
    if (hosts.length === 0) {
      setStatus("Adicione ao menos um domínio/host permitido.");
      return;
    }

    const first = repos[0];
    const { owner, repo } = normalizeGitHubRepoRef(first.owner, first.repo);

    const origins = originPatternsForHosts(hosts);
    try {
      const granted = await chrome.permissions.request({ origins });
      if (!granted) {
        setStatus(
          "Permissão de host não concedida: a extensão pode não aparecer em alguns domínios até você aprovar.",
        );
      }
    } catch {
      setStatus("Não foi possível solicitar permissões para os hosts informados.");
    }

    const iaPattern = iaOriginPatternFromBaseUrl(settings.iaServiceBaseUrl ?? "");
    if (iaPattern) {
      try {
        const iaGranted = await chrome.permissions.request({ origins: [iaPattern] });
        if (!iaGranted) {
          setStatus(
            (prev) =>
              prev ??
              "Permissão para o host do serviço de IA não concedida: o refine pode falhar até aprovar no Chrome.",
          );
        }
      } catch {
        setStatus((prev) => prev ?? "Não foi possível solicitar permissão para o serviço de IA.");
      }
    }

    const next: ExtensionSettings = {
      ...settings,
      owner,
      repo,
      repos,
      allowedHosts: hosts,
    };
    setSettings(next);
    setHostsText(hostsToText(hosts));
    setReposText(formatReposForTextarea(repos));
    await saveSettings(next);
    setStatus((prev) => prev ?? "Configurações salvas.");
  }, [hostsText, reposText, settings]);

  const onTest = useCallback(async () => {
    setTesting(true);
    setStatus(null);
    try {
      if (!settings.githubToken.trim()) {
        setStatus("Informe o GitHub token antes de testar.");
        setTesting(false);
        return;
      }
      const res = (await chrome.runtime.sendMessage({
        type: "TEST_GITHUB",
        token: settings.githubToken,
      })) as
        | { ok: true; repos: { fullName: string }[] }
        | { ok: false; message?: string };

      if (res.ok && "repos" in res && Array.isArray(res.repos)) {
        const lines = res.repos.map((r) => r.fullName).join("\n");
        setReposText(lines);
        const n = res.repos.length;
        setStatus(
          n > 0
            ? `Conexão OK. ${n} repositório(s) carregado(s) na lista. Revise, edite se quiser e clique em Salvar.`
            : "Token válido, mas a API não devolveu repositórios (confira escopos do PAT ou repositórios do token fine-grained).",
        );
      } else if (!res.ok) {
        setStatus(res.message ?? "Falha ao testar conexão.");
      }
    } catch {
      setStatus("Erro ao comunicar com o service worker.");
    } finally {
      setTesting(false);
    }
  }, [settings.githubToken]);

  const onClearToken = useCallback(async () => {
    const next = { ...settings, githubToken: "" };
    setSettings(next);
    await saveSettings(next);
    setStatus("Token removido.");
  }, [settings]);

  if (!loaded) {
    return <p style={{ fontFamily: "system-ui", padding: 16 }}>Carregando…</p>;
  }

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 640,
        margin: "24px auto",
        padding: "0 16px",
        color: "#0f172a",
      }}
    >
      <h1 style={{ fontSize: 22 }}>QA Feedback → GitHub</h1>
      <p style={{ color: "#475569", fontSize: 14 }}>
        Use um <strong>fine-grained personal access token</strong> só com permissão de Issues (recomendado para QA) ou um
        PAT classic com escopo <code>repo</code>.
      </p>

      <aside
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 10,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          fontSize: 14,
          color: "#334155",
        }}
      >
        <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
          Como criar o token (fine-grained)
        </h2>
        <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.6 }}>
          <li style={{ marginBottom: 8 }}>
            Aceda a{" "}
            <a
              href="https://github.com/settings/personal-access-tokens"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#2563eb", fontWeight: 600 }}
            >
              github.com/settings/personal-access-tokens
            </a>
            . Na secção <strong>Fine-grained personal access tokens</strong>, clique em{" "}
            <strong>Generate new token</strong> e escolha a opção fine-grained.
          </li>
          <li style={{ marginBottom: 8 }}>
            Em <strong>Token name</strong>, escreva <code style={{ background: "#e2e8f0", padding: "1px 6px", borderRadius: 4 }}>QAFeedback</code>{" "}
            (assim fica fácil de reconhecer no GitHub).
          </li>
          <li style={{ marginBottom: 8 }}>
            Em <strong>Repository access</strong>, inclua os repositórios onde o QA vai abrir issues (por exemplo{" "}
            <em>Only select repositories</em> e escolha os projetos, ou outra opção adequada à conta).
          </li>
          <li style={{ marginBottom: 8 }}>
            Em <strong>Permissions</strong> → separador <strong>Repositories</strong> → <strong>Add permissions</strong> →
            procure <strong>Issues</strong> e defina <strong>Read and write</strong>.{" "}
            <strong>Não precisa de outras permissões</strong> para esta extensão.
          </li>
          <li>
            Clique em <strong>Generate token</strong>, copie o valor e cole no campo <strong>GitHub token</strong> abaixo
            (o GitHub só mostra o token completo uma vez).
          </li>
        </ol>
      </aside>

      <section style={{ marginTop: 24 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="token">
          GitHub token
        </label>
        <input
          id="token"
          type="password"
          autoComplete="off"
          value={settings.githubToken}
          onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 8, marginBottom: 0 }}>
          <strong>Testar conexão</strong> valida o token e <strong>preenche a lista</strong> com os repositórios que a API permite ver (até milhares, em páginas de 100).
        </p>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={onTest} disabled={testing} style={btnPrimary}>
            {testing ? "Carregando…" : "Testar conexão e listar repos"}
          </button>
          <button type="button" onClick={onClearToken} style={btnGhost}>
            Apagar token
          </button>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="repos">
          Repositórios destino (um por linha)
        </label>
        <textarea
          id="repos"
          value={reposText}
          onChange={(e) => setReposText(e.target.value)}
          rows={8}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", fontFamily: "monospace", fontSize: 13 }}
          placeholder={"jorgsouza/meu-repo\norg/outro-repo|Projeto legado\nhttps://github.com/org/repo"}
        />
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
          Formato: <code>owner/repo</code>, URL do GitHub ou <code>owner/repo|Nome no menu</code>. O QA escolhe qual usar ao abrir o feedback.
        </p>
      </section>

      <section style={{ marginTop: 20 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="ia-url">
          URL base do serviço de IA (opcional)
        </label>
        <input
          id="ia-url"
          type="url"
          autoComplete="off"
          placeholder="https://ia-feedback.empresa.com ou http://127.0.0.1:8787"
          value={settings.iaServiceBaseUrl ?? ""}
          onChange={(e) => setSettings({ ...settings, iaServiceBaseUrl: e.target.value })}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
          Separado dos <strong>Domínios permitidos</strong> (onde o botão aparece). Ao salvar, o Chrome pode pedir permissão para este host.
        </p>
        <label
          style={{ display: "block", fontWeight: 600, marginBottom: 6, marginTop: 12 }}
          htmlFor="ia-key"
        >
          Chave da API do serviço de IA (opcional)
        </label>
        <input
          id="ia-key"
          type="password"
          autoComplete="off"
          placeholder="Mesmo valor que IA_FEEDBACK_API_KEY no servidor"
          value={settings.iaServiceApiKey ?? ""}
          onChange={(e) => setSettings({ ...settings, iaServiceApiKey: e.target.value })}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
      </section>

      <section style={{ marginTop: 20 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }} htmlFor="hosts">
          Domínios permitidos (um por linha)
        </label>
        <textarea
          id="hosts"
          value={hostsText}
          onChange={(e) => setHostsText(e.target.value)}
          rows={6}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
        />
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
          Padrão: localhost e 127.0.0.1. Ao salvar, o Chrome pode pedir permissão para cada host novo.
        </p>
      </section>

      <div style={{ marginTop: 20 }}>
        <button type="button" onClick={() => void onSave()} style={btnPrimary}>
          Salvar
        </button>
      </div>

      {status && (
        <p
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: 14,
          }}
        >
          {status}
        </p>
      )}
    </div>
  );
}

const btnPrimary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};
