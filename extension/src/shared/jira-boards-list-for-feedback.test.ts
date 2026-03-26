import { describe, expect, it } from "vitest";
import {
  coerceJiraBoardIdRequest,
  pickJiraBoardIdForCreate,
  sortJiraBoardsByName,
} from "./jira-boards-list-for-feedback";

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

const listOk = (boards: { id: number; name: string; type: string }[], defaultBoardId: string) =>
  ({ ok: true as const, boards, defaultBoardId });

describe("pickJiraBoardIdForCreate", () => {
  it("uses requested id when present and allowed (no fallback)", () => {
    const r = pickJiraBoardIdForCreate(listOk([{ id: 451, name: "A", type: "scrum" }], "451"), "453");
    expect(r).toEqual({
      ok: false,
      message: expect.stringContaining("453"),
    });
  });

  it("accepts requested id when it is in the allowed list", () => {
    const r = pickJiraBoardIdForCreate(
      listOk(
        [
          { id: 451, name: "Growth", type: "scrum" },
          { id: 453, name: "Resolução", type: "scrum" },
        ],
        "451",
      ),
      "453",
    );
    expect(r).toEqual({ ok: true, boardIdStr: "453", usedExplicitSelection: true });
  });

  it("uses default when no explicit request", () => {
    const r = pickJiraBoardIdForCreate(
      listOk(
        [
          { id: 451, name: "Growth", type: "scrum" },
          { id: 453, name: "Resolução", type: "scrum" },
        ],
        "453",
      ),
      undefined,
    );
    expect(r).toEqual({ ok: true, boardIdStr: "453", usedExplicitSelection: false });
  });

  it("does not fall back to default when explicit id is invalid", () => {
    const r = pickJiraBoardIdForCreate(
      listOk([{ id: 451, name: "Growth", type: "scrum" }], "451"),
      "999",
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected error");
    expect(r.message).toContain("999");
  });
});
