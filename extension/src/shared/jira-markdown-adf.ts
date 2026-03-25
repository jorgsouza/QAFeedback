/**
 * Converte um subconjunto do Markdown do corpo da issue em ADF (Jira Cloud API v3).
 * Evita enviar `##` e `**` como literais dentro de um único parágrafo.
 */

export type AdfDoc = { type: "doc"; version: 1; content: unknown[] };

type MdBlock =
  | { kind: "h2"; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function mergeAdjacentText(nodes: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const n of nodes) {
    const cur = n as { type?: string; text?: string; marks?: unknown[] };
    const last = out[out.length - 1] as { type?: string; text?: string; marks?: unknown[] } | undefined;
    if (
      cur?.type === "text" &&
      last?.type === "text" &&
      JSON.stringify(cur.marks ?? null) === JSON.stringify(last.marks ?? null)
    ) {
      last.text = (last.text ?? "") + (cur.text ?? "");
    } else {
      out.push(n);
    }
  }
  return out.length ? out : [{ type: "text", text: " " }];
}

function parseBoldAndPlain(s: string): unknown[] {
  const out: unknown[] = [];
  let rest = s;
  while (rest.length) {
    const open = rest.indexOf("**");
    if (open === -1) {
      if (rest) out.push({ type: "text", text: rest });
      break;
    }
    if (open > 0) out.push({ type: "text", text: rest.slice(0, open) });
    const close = rest.indexOf("**", open + 2);
    if (close === -1) {
      out.push({ type: "text", text: rest.slice(open) });
      break;
    }
    const inner = rest.slice(open + 2, close);
    out.push({ type: "text", text: inner, marks: [{ type: "strong" }] });
    rest = rest.slice(close + 2);
  }
  return out;
}

/** Inline: `` `code` `` e depois **negrito** nos troços restantes. */
export function parseInlineToAdf(text: string): unknown[] {
  const out: unknown[] = [];
  let i = 0;
  while (i < text.length) {
    const bt = text.indexOf("`", i);
    if (bt === -1) {
      out.push(...parseBoldAndPlain(text.slice(i)));
      break;
    }
    if (bt > i) {
      out.push(...parseBoldAndPlain(text.slice(i, bt)));
    }
    const bt2 = text.indexOf("`", bt + 1);
    if (bt2 === -1) {
      out.push({ type: "text", text: text.slice(bt) });
      break;
    }
    const codeText = text.slice(bt + 1, bt2);
    out.push({
      type: "text",
      text: codeText || " ",
      marks: [{ type: "code" }],
    });
    i = bt2 + 1;
  }
  return mergeAdjacentText(out);
}

function paragraphFromLines(lines: string[]): { type: "paragraph"; content: unknown[] } {
  const content: unknown[] = [];
  for (let li = 0; li < lines.length; li++) {
    if (li > 0) content.push({ type: "hardBreak" });
    content.push(...parseInlineToAdf(lines[li]!));
  }
  return { type: "paragraph", content: content.length ? content : [{ type: "text", text: " " }] };
}

export function parseIssueMarkdownToBlocks(markdown: string): MdBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = (): void => {
    if (para.length) {
      blocks.push({ kind: "p", lines: [...para] });
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("## ")) {
      flushPara();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      i++;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i]!.trim();
        if (!t.startsWith("- ")) break;
        items.push(t.slice(2).trim());
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(/^\s*\d+\.\s+(.*)$/);
        if (!m) break;
        items.push(m[1]!.trim());
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    if (trimmed === "") {
      flushPara();
      i++;
      continue;
    }

    para.push(line);
    i++;
  }
  flushPara();
  return blocks;
}

function blocksToAdf(blocks: MdBlock[]): unknown[] {
  const content: unknown[] = [];
  for (const b of blocks) {
    if (b.kind === "h2") {
      if (!b.text) continue;
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: b.text.slice(0, 500) }],
      });
      continue;
    }
    if (b.kind === "p") {
      content.push(paragraphFromLines(b.lines));
      continue;
    }
    if (b.kind === "ul") {
      const listItems = b.items.map((item) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: parseInlineToAdf(item),
          },
        ],
      }));
      content.push({ type: "bulletList", content: listItems });
      continue;
    }
    if (b.kind === "ol") {
      const listItems = b.items.map((item) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: parseInlineToAdf(item),
          },
        ],
      }));
      content.push({
        type: "orderedList",
        attrs: { order: 1 },
        content: listItems,
      });
    }
  }
  if (!content.length) {
    return [{ type: "paragraph", content: [{ type: "text", text: " " }] }];
  }
  return content;
}

/** Corpo gerado por `buildIssueBody` (Markdown “nosso”) → ADF para POST /issue. */
export function markdownIssueBodyToAdf(markdown: string): AdfDoc {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: " " }] }] };
  }
  const blocks = parseIssueMarkdownToBlocks(trimmed);
  return { type: "doc", version: 1, content: blocksToAdf(blocks) };
}
