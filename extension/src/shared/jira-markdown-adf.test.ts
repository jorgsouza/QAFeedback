import { describe, expect, it } from "vitest";
import { markdownIssueBodyToAdf, parseInlineToAdf } from "./jira-markdown-adf";

describe("parseInlineToAdf", () => {
  it("parses strong and code", () => {
    const nodes = parseInlineToAdf("**a** and `b`");
    const types = nodes.map((n) => (n as { type: string; marks?: unknown[] }).type);
    expect(types.filter((t) => t === "text").length).toBeGreaterThanOrEqual(2);
    const withStrong = nodes.find(
      (n) => (n as { marks?: { type: string }[] }).marks?.some((m) => m.type === "strong"),
    );
    expect(withStrong).toBeTruthy();
    const withCode = nodes.find(
      (n) => (n as { marks?: { type: string }[] }).marks?.some((m) => m.type === "code"),
    );
    expect(withCode).toBeTruthy();
  });
});

describe("markdownIssueBodyToAdf", () => {
  it("creates heading and bulletList from markdown sections", () => {
    const md = `## Resumo\nUma linha\n\n## Lista\n- item **um**\n- \`dois\`\n`;
    const adf = markdownIssueBodyToAdf(md);
    expect(adf.type).toBe("doc");
    expect(adf.content.length).toBeGreaterThanOrEqual(2);
    const h = adf.content[0] as { type: string; attrs?: { level: number } };
    expect(h.type).toBe("heading");
    expect(h.attrs?.level).toBe(2);
    const bl = adf.content.find((n) => (n as { type: string }).type === "bulletList") as {
      type: string;
      content: unknown[];
    };
    expect(bl?.type).toBe("bulletList");
    expect(bl?.content?.length).toBe(2);
  });

  it("parses ordered list blocks", () => {
    const md = `## Passos\n1. primeiro\n2. **segundo**\n`;
    const adf = markdownIssueBodyToAdf(md);
    const ol = adf.content.find((n) => (n as { type: string }).type === "orderedList") as {
      type: string;
      content: unknown[];
    };
    expect(ol?.type).toBe("orderedList");
    expect(ol?.content?.length).toBe(2);
  });
});
