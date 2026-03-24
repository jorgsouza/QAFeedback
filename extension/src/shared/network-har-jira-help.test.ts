import { describe, expect, it } from "vitest";
import { networkHarJiraDescriptionMarkdown } from "./network-har-jira-help";

describe("networkHarJiraDescriptionMarkdown", () => {
  it("inclui o nome do ficheiro e instruções", () => {
    const md = networkHarJiraDescriptionMarkdown("qa-feedback-network-test.har");
    expect(md).toContain("qa-feedback-network-test.har");
    expect(md).toContain("HAR");
    expect(md).toContain("DevTools");
    expect(md).toContain("[REDACTED]");
  });
});
