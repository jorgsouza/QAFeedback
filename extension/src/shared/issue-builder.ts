import type { CreateIssuePayload, ElementContext } from "./types";
import { EXTENSION_ROOT_HOST_ID } from "./extension-constants";
import { truncate } from "./sanitizer";

function shouldIncludeElementSection(e: ElementContext): boolean {
  if (e.id === EXTENSION_ROOT_HOST_ID) return false;
  const t = e.tag.toLowerCase();
  if ((t === "html" || t === "body") && !e.id && !e.classes?.trim()) return false;
  return true;
}

function omitEmptySection(title: string, body: string | undefined): string {
  const b = body?.trim();
  if (!b) return "";
  return `## ${title}\n${b}\n\n`;
}

function formatConsole(entries: { level: string; message: string }[]): string {
  if (!entries.length) return "";
  return entries
    .map((e) => `- (${e.level}) ${truncate(e.message, 400)}`)
    .join("\n");
}

function formatFailed(reqs: { method: string; url: string; status: number; message: string }[]): string {
  if (!reqs.length) return "";
  return reqs
    .map(
      (r) =>
        `- ${r.method} ${r.url} → ${r.status}${r.message ? ` (${truncate(r.message, 200)})` : ""}`,
    )
    .join("\n");
}

export function buildIssueBody(payload: CreateIssuePayload): string {
  const { title: _t, includeTechnicalContext: _i, capturedContext: ctx, ...form } = payload;
  let md = "";
  md += omitEmptySection("O que aconteceu", form.whatHappened);

  if (payload.includeTechnicalContext && ctx) {
    const p = ctx.page;
    md += "## Contexto técnico\n";
    md += `- URL: ${p.url}\n`;
    const searchBit = p.routeSearch.trim() ? ` · query: ${truncate(p.routeSearch, 200)}` : "";
    md += `- Rota técnica: \`${p.routeSlug}\` · ${p.routeLabel} · path: \`${p.pathname}\`${searchBit}\n`;
    md += `- Página: ${p.title}\n`;
    md += `- Data/Hora: ${p.timestamp}\n`;
    md += `- Navegador: ${truncate(p.userAgent, 300)}\n`;
    md += `- Viewport (janela): ${p.viewport}\n`;
    md += `- Ecrã (screen): ${p.screenCss} · DPR: ${p.devicePixelRatio} · maxTouchPoints: ${p.maxTouchPoints} · pointer: ${p.pointerCoarse ? "coarse" : "fine"}\n`;
    md += `- Vista / dispositivo (indício automático): ${p.viewModeHint}\n\n`;

    if (ctx.element && shouldIncludeElementSection(ctx.element)) {
      const e = ctx.element;
      md += "## Elemento afetado\n";
      md += `- Tag: ${e.tag}\n`;
      md += `- ID: ${e.id || "(sem id)"}\n`;
      md += `- Classes: ${e.classes || "(sem classes)"}\n`;
      if (e.safeAttributes) md += `- Atributos: ${e.safeAttributes}\n`;
      md += "\n";
    }

    const c = formatConsole(ctx.console);
    if (c) {
      md += "## Console\n";
      md += `${c}\n\n`;
    }

    const f = formatFailed(ctx.failedRequests);
    if (f) {
      md += "## Requests com falha\n";
      md += `${f}\n\n`;
    }
  }

  return md.trimEnd();
}

export function buildIssueTitle(payload: CreateIssuePayload): string {
  return payload.title.trim();
}
