import { describe, expect, it, vi } from "vitest";
import {
  inferJiraCloudSiteUrlFromEmail,
  isJiraSprintBoardMoveError,
  jiraBoardWebUrlFromUserInput,
  jiraResolvedBoardWebUrl,
  listJiraBoards,
  normalizeJiraSiteUrl,
  parseJiraSoftwareBoardId,
  plainTextToAdf,
  resolveJiraCloudBaseUrl,
  resolveJiraSoftwareBoardId,
} from "./jira-client";

describe("inferJiraCloudSiteUrlFromEmail", () => {
  it("maps corporate domain first label to atlassian.net", () => {
    expect(inferJiraCloudSiteUrlFromEmail("jorge.souza@reclameaqui.com.br")).toBe(
      "https://reclameaqui.atlassian.net",
    );
  });

  it("returns null for gmail", () => {
    expect(inferJiraCloudSiteUrlFromEmail("x@gmail.com")).toBeNull();
  });
});

describe("resolveJiraCloudBaseUrl", () => {
  it("prefers explicit site URL over email inference", () => {
    expect(resolveJiraCloudBaseUrl("https://foo.atlassian.net", "a@gmail.com")).toBe(
      "https://foo.atlassian.net",
    );
  });

  it("falls back to email when site empty", () => {
    expect(resolveJiraCloudBaseUrl("", "user@reclameaqui.com.br")).toBe(
      "https://reclameaqui.atlassian.net",
    );
  });
});

describe("normalizeJiraSiteUrl", () => {
  it("accepts atlassian.net https", () => {
    expect(normalizeJiraSiteUrl("https://reclameaqui.atlassian.net/")).toBe(
      "https://reclameaqui.atlassian.net",
    );
  });

  it("normalizes backlog/board URL to site base", () => {
    expect(
      normalizeJiraSiteUrl(
        "https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451/backlog",
      ),
    ).toBe("https://reclameaqui.atlassian.net");
  });

  it("rejects non-atlassian", () => {
    expect(normalizeJiraSiteUrl("https://example.com")).toBeNull();
  });

  it("rejects http", () => {
    expect(normalizeJiraSiteUrl("http://x.atlassian.net")).toBeNull();
  });
});

describe("parseJiraSoftwareBoardId", () => {
  it("reads board id from backlog URL", () => {
    expect(
      parseJiraSoftwareBoardId(
        "https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451/backlog",
      ),
    ).toBe(451);
  });

  it("returns null without boards segment", () => {
    expect(parseJiraSoftwareBoardId("https://reclameaqui.atlassian.net")).toBeNull();
  });
});

describe("jiraBoardWebUrlFromUserInput", () => {
  it("builds board URL without selected issue", () => {
    expect(
      jiraBoardWebUrlFromUserInput(
        "https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451",
      ),
    ).toBe("https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451");
  });

  it("strips /backlog and adds selectedIssue", () => {
    expect(
      jiraBoardWebUrlFromUserInput(
        "https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451/backlog",
        "REC-27734",
      ),
    ).toBe(
      "https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451?selectedIssue=REC-27734",
    );
  });

  it("returns null for site-only URL", () => {
    expect(jiraBoardWebUrlFromUserInput("https://reclameaqui.atlassian.net")).toBeNull();
  });
});

describe("resolveJiraSoftwareBoardId", () => {
  it("prefers saved id over URL", () => {
    expect(
      resolveJiraSoftwareBoardId(
        "https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/999/backlog",
        "451",
      ),
    ).toBe(451);
  });

  it("falls back to URL when saved empty", () => {
    expect(
      resolveJiraSoftwareBoardId(
        "https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451/backlog",
        "",
      ),
    ).toBe(451);
  });
});

describe("jiraResolvedBoardWebUrl", () => {
  it("builds URL from saved board id and project", () => {
    expect(
      jiraResolvedBoardWebUrl({
        siteUrl: "https://reclameaqui.atlassian.net",
        projectKey: "REC",
        jiraSoftwareBoardId: "451",
        selectedIssueKey: "REC-1",
      }),
    ).toBe("https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451?selectedIssue=REC-1");
  });

  it("falls back to pasted board path when no saved id", () => {
    expect(
      jiraResolvedBoardWebUrl({
        siteUrl: "https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451",
        projectKey: "REC",
        jiraSoftwareBoardId: "",
        selectedIssueKey: "REC-2",
      }),
    ).toBe("https://reclameaqui.atlassian.net/jira/software/c/projects/REC/boards/451?selectedIssue=REC-2");
  });
});

describe("isJiraSprintBoardMoveError", () => {
  it("detects Scrum sprint-board rejection from API", () => {
    expect(
      isJiraSprintBoardMoveError(
        "400: Tried to move to board on board with sprints use sprint/{sprintid}/issues instead",
      ),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isJiraSprintBoardMoveError("403: Forbidden")).toBe(false);
  });
});

describe("listJiraBoards", () => {
  it("paginates until isLast", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ values: [{ id: 1, name: "A", type: "scrum" }], isLast: false }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ values: [{ id: 2, name: "B", type: "kanban" }], isLast: true }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const r = await listJiraBoards({
      siteUrl: "https://test.atlassian.net",
      email: "a@b.com",
      apiToken: "tok",
      projectKey: "REC",
    });
    expect(r.ok && r.boards).toEqual([
      { id: 1, name: "A", type: "scrum" },
      { id: 2, name: "B", type: "kanban" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("omits projectKeyOrId when project key empty (all boards)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ values: [{ id: 1, name: "A", type: "scrum" }], isLast: true }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await listJiraBoards({
      siteUrl: "https://test.atlassian.net",
      email: "a@b.com",
      apiToken: "tok",
      projectKey: "",
    });
    expect(r.ok && r.boards).toHaveLength(1);
    const called = fetchMock.mock.calls[0]![0] as string;
    expect(called).toContain("/rest/agile/1.0/board");
    expect(called).not.toContain("projectKeyOrId");
    vi.unstubAllGlobals();
  });
});

describe("plainTextToAdf", () => {
  it("builds doc with paragraph", () => {
    const adf = plainTextToAdf("Hello\n\nWorld");
    expect(adf.type).toBe("doc");
    expect(adf.version).toBe(1);
    expect(Array.isArray(adf.content)).toBe(true);
  });

  it("uses hardBreak for single newlines inside a paragraph (ADF for description)", () => {
    const adf = plainTextToAdf("Line1\nLine2");
    const para = adf.content[0] as { type: string; content: Array<{ type: string; text?: string }> };
    expect(para.type).toBe("paragraph");
    expect(para.content.map((n) => n.type)).toEqual(["text", "hardBreak", "text"]);
    expect(para.content[0]?.text).toBe("Line1");
    expect(para.content[2]?.text).toBe("Line2");
  });
});
