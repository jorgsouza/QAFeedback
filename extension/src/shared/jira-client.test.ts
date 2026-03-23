import { describe, expect, it } from "vitest";
import { normalizeJiraSiteUrl, plainTextToAdf } from "./jira-client";

describe("normalizeJiraSiteUrl", () => {
  it("accepts atlassian.net https", () => {
    expect(normalizeJiraSiteUrl("https://reclameaqui.atlassian.net/")).toBe(
      "https://reclameaqui.atlassian.net",
    );
  });

  it("rejects non-atlassian", () => {
    expect(normalizeJiraSiteUrl("https://example.com")).toBeNull();
  });

  it("rejects http", () => {
    expect(normalizeJiraSiteUrl("http://x.atlassian.net")).toBeNull();
  });
});

describe("plainTextToAdf", () => {
  it("builds doc with paragraph", () => {
    const adf = plainTextToAdf("Hello\n\nWorld");
    expect(adf.type).toBe("doc");
    expect(adf.version).toBe(1);
    expect(Array.isArray(adf.content)).toBe(true);
  });
});
