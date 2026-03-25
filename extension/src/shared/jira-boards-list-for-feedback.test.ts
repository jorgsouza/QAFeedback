import { describe, expect, it } from "vitest";
import { coerceJiraBoardIdRequest, sortJiraBoardsByName } from "./jira-boards-list-for-feedback";

describe("sortJiraBoardsByName", () => {
  it("orders by name case-insensitively", () => {
    const boards = [
      { id: 3, name: "Zebra", type: "scrum" },
      { id: 1, name: "Alpha", type: "kanban" },
      { id: 2, name: "beta", type: "scrum" },
    ];
    expect(sortJiraBoardsByName(boards).map((b) => b.id)).toEqual([1, 2, 3]);
  });
});

describe("coerceJiraBoardIdRequest", () => {
  it("normalizes string and number", () => {
    expect(coerceJiraBoardIdRequest(" 2700 ")).toBe("2700");
    expect(coerceJiraBoardIdRequest(2700)).toBe("2700");
  });

  it("returns empty for invalid", () => {
    expect(coerceJiraBoardIdRequest("")).toBe("");
    expect(coerceJiraBoardIdRequest(undefined)).toBe("");
    expect(coerceJiraBoardIdRequest({})).toBe("");
  });
});
