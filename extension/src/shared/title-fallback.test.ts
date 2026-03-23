import { describe, expect, it } from "vitest";
import { buildFallbackIssueTitle, MAX_ISSUE_TITLE_LENGTH, truncateIssueTitle } from "./title-fallback";

describe("buildFallbackIssueTitle", () => {
  it("returns empty for blank", () => {
    expect(buildFallbackIssueTitle("   ")).toBe("");
  });

  it("uses first six whitespace-separated tokens", () => {
    expect(buildFallbackIssueTitle("um dois três quatro cinco seis sete")).toBe("um dois três quatro cinco seis");
  });

  it("treats comma-glued token as one word", () => {
    expect(buildFallbackIssueTitle("não,isto é um teste longo extra")).toBe("não,isto é um teste longo extra");
    expect(buildFallbackIssueTitle("não,isto é um teste longo extra mais palavras")).toBe(
      "não,isto é um teste longo extra",
    );
  });
});

describe("truncateIssueTitle", () => {
  it("adds ellipsis when over max", () => {
    const long = "x".repeat(MAX_ISSUE_TITLE_LENGTH + 10);
    const out = truncateIssueTitle(long);
    expect(out.length).toBeLessThanOrEqual(MAX_ISSUE_TITLE_LENGTH);
    expect(out.endsWith("…")).toBe(true);
  });
});
