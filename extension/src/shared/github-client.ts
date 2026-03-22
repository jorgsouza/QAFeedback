import type { CreateIssuePayload } from "./types";
import { buildIssueBody, buildIssueTitle } from "./issue-builder";
import { normalizeGitHubRepoRef } from "./github-repo-normalize";

export type GitHubError = {
  ok: false;
  message: string;
  status?: number;
};

export type GitHubIssueResult = {
  ok: true;
  htmlUrl: string;
  number: number;
};

function parseErrorMessage(status: number, body: string): string {
  try {
    const j = JSON.parse(body) as { message?: string; errors?: { message?: string }[] };
    if (j.message) return `${status}: ${j.message}`;
    if (j.errors?.[0]?.message) return `${status}: ${j.errors[0].message}`;
  } catch {
    /* ignore */
  }
  return `${status}: resposta inválida da API do GitHub`;
}

export type ListedRepo = {
  owner: string;
  repo: string;
  fullName: string;
};

/**
 * Valida o token e lista repositórios acessíveis (GET /user/repos, paginado).
 * PAT classic: escopo `repo` ou ao menos leitura nos repos. Fine-grained: repositórios concedidos ao token.
 */
export async function testTokenAndListRepos(token: string): Promise<
  { ok: true; repos: ListedRepo[] } | GitHubError
> {
  if (!token.trim()) return { ok: false, message: "Token vazio." };

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token.trim()}`,
  };

  const userRes = await fetch("https://api.github.com/user", { headers });
  if (!userRes.ok) {
    return {
      ok: false,
      message: parseErrorMessage(userRes.status, await userRes.text()),
      status: userRes.status,
    };
  }

  const out: ListedRepo[] = [];
  const seen = new Set<string>();
  let page = 1;
  const maxPages = 40;

  while (page <= maxPages) {
    const url = new URL("https://api.github.com/user/repos");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "full_name");
    url.searchParams.set("affiliation", "owner,collaborator,organization_member");

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      return {
        ok: false,
        message: parseErrorMessage(res.status, await res.text()),
        status: res.status,
      };
    }

    const batch = (await res.json()) as {
      name: string;
      full_name: string;
      owner: { login: string };
    }[];

    if (!batch.length) break;

    for (const r of batch) {
      const key = r.full_name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        owner: r.owner.login,
        repo: r.name,
        fullName: r.full_name,
      });
    }

    if (batch.length < 100) break;
    page += 1;
  }

  out.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));
  return { ok: true, repos: out };
}

export async function createGitHubIssue(params: {
  token: string;
  owner: string;
  repo: string;
  payload: CreateIssuePayload;
}): Promise<GitHubIssueResult | GitHubError> {
  const { token, payload } = params;
  const { owner, repo } = normalizeGitHubRepoRef(params.owner, params.repo);
  const title = buildIssueTitle(payload);
  const body = buildIssueBody(payload);
  if (!title) return { ok: false, message: "Título obrigatório." };
  if (!payload.whatHappened?.trim()) return { ok: false, message: '"O que aconteceu" é obrigatório.' };
  if (!owner || !repo) return { ok: false, message: "Owner ou repositório inválido nas opções." };

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${token.trim()}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ title, body }),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, message: parseErrorMessage(res.status, text), status: res.status };
  }

  try {
    const j = JSON.parse(text) as { html_url?: string; number?: number };
    if (!j.html_url || typeof j.number !== "number") {
      return { ok: false, message: "Resposta inesperada ao criar issue." };
    }
    return { ok: true, htmlUrl: j.html_url, number: j.number };
  } catch {
    return { ok: false, message: "Não foi possível interpretar a resposta da API." };
  }
}
