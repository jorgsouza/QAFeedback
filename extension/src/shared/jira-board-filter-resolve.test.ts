import { describe, expect, it } from "vitest";
import {
  allowedIssueTypesFromBoardJql,
  coerceBugToTaskForBoardFilter,
  coerceJiraBoardFilterId,
  filterConstraintsForCreateIssue,
  matchConstraintsToCreateMeta,
  normalizeJqlFieldLabel,
  parseJqlEqualityConstraints,
  parseJqlIssueTypeInList,
  parseJqlIssueTypeSingleEquals,
  stripJqlOrderBy,
} from "./jira-board-filter-resolve";

describe("coerceJiraBoardFilterId", () => {
  it("accepts string ids from Jira Cloud board configuration", () => {
    expect(coerceJiraBoardFilterId("18279")).toBe(18279);
  });
  it("accepts numeric ids", () => {
    expect(coerceJiraBoardFilterId(18279)).toBe(18279);
  });
  it("returns undefined for empty or invalid", () => {
    expect(coerceJiraBoardFilterId("")).toBeUndefined();
    expect(coerceJiraBoardFilterId("abc")).toBeUndefined();
    expect(coerceJiraBoardFilterId(undefined)).toBeUndefined();
  });
});

describe("stripJqlOrderBy", () => {
  it("removes ORDER BY tail", () => {
    expect(stripJqlOrderBy('project = REC ORDER BY Rank ASC')).toBe("project = REC");
  });
});

describe("parseJqlIssueTypeInList", () => {
  it("parses type IN with quoted and bare identifiers (Lane de Inovação / CNS)", () => {
    const jql =
      'project IN (14726) AND type IN (Iniciativa, "Atividade Especializada", Experimento)\nORDER BY Rank ASC';
    expect(parseJqlIssueTypeInList(jql)).toEqual([
      "Iniciativa",
      "Atividade Especializada",
      "Experimento",
    ]);
  });

  it("returns empty when there is no type IN clause", () => {
    expect(parseJqlIssueTypeInList('project = REC AND "squad" = "A"')).toEqual([]);
  });
});

describe("parseJqlIssueTypeSingleEquals", () => {
  it("reads issuetype = Task", () => {
    expect(parseJqlIssueTypeSingleEquals('project = REC AND issuetype = Task')).toBe("Task");
  });

  it("reads quoted issue type", () => {
    expect(parseJqlIssueTypeSingleEquals('project = REC AND issuetype = "Sub-task"')).toBe("Sub-task");
  });
});

describe("allowedIssueTypesFromBoardJql", () => {
  it("prefers type IN over single equals", () => {
    const jql = "project = X AND type IN (Task, Story) AND issuetype = Bug";
    expect(allowedIssueTypesFromBoardJql(jql)).toEqual(["Task", "Story"]);
  });

  it("uses single equals when there is no IN list", () => {
    expect(allowedIssueTypesFromBoardJql("project = REC AND issuetype = Task")).toEqual(["Task"]);
  });
});

describe("coerceBugToTaskForBoardFilter", () => {
  it("switches Bug to Task when Task is allowed and Bug is not", () => {
    expect(coerceBugToTaskForBoardFilter("Bug", ["Task", "Story"])).toBe("Task");
  });

  it("keeps Bug when Bug is in the list", () => {
    expect(coerceBugToTaskForBoardFilter("Bug", ["Bug", "Task"])).toBe("Bug");
  });

  it("preserves casing of Task from JQL", () => {
    expect(coerceBugToTaskForBoardFilter("bug", ["task", "story"])).toBe("task");
  });
});

describe("parseJqlEqualityConstraints", () => {
  it("parses quoted pairs and cf[]", () => {
    const jql = 'project = REC AND "squad[dropdown]" = "B2C - Growth" AND cf[12071] = "X" ORDER BY x';
    const c = parseJqlEqualityConstraints(jql);
    expect(c.some((x) => x.left === "squad[dropdown]" && x.right === "B2C - Growth")).toBe(true);
    expect(c.some((x) => x.left === "customfield_12071" && x.right === "X" && x.kind === "cf")).toBe(true);
  });
});

describe("filterConstraintsForCreateIssue", () => {
  it("drops project and issuetype", () => {
    const raw = parseJqlEqualityConstraints('"Project" = "X" AND "Squad" = "A" AND "issuetype" = "Bug"');
    const f = filterConstraintsForCreateIssue(raw);
    expect(f.map((x) => x.left)).toEqual(["Squad"]);
  });
});

describe("normalizeJqlFieldLabel", () => {
  it("strips bracket suffix", () => {
    expect(normalizeJqlFieldLabel("squad[dropdown]")).toBe("squad");
  });
});

describe("matchConstraintsToCreateMeta", () => {
  it("maps squad select by name and value", () => {
    const issueFields = {
      customfield_12071: {
        name: "Squad",
        schema: { type: "option", custom: "select" },
        allowedValues: [{ id: "12287", value: "B2C - Growth" }],
      },
    };
    const { fields, unresolved } = matchConstraintsToCreateMeta(
      [{ left: "squad[dropdown]", right: "B2C - Growth", kind: "quoted" }],
      issueFields,
    );
    expect(unresolved).toEqual([]);
    expect(fields).toHaveLength(1);
    expect(fields[0]!.fieldId).toBe("customfield_12071");
    expect(fields[0]!.set).toEqual({ id: "12287" });
  });
});
