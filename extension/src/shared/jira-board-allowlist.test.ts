import { describe, expect, it } from "vitest";
import { filterJiraBoardsByAllowlist, parseJiraBoardAllowlist } from "./jira-board-allowlist";

describe("parseJiraBoardAllowlist", () => {
  it("returns empty for empty or whitespace", () => {
    expect(parseJiraBoardAllowlist("")).toEqual([]);
    expect(parseJiraBoardAllowlist("   ")).toEqual([]);
  });

  it("parses comma-separated positive integers", () => {
    expect(parseJiraBoardAllowlist("455,451,453")).toEqual([455, 451, 453]);
  });

  it("deduplicates and ignores invalid tokens", () => {
    expect(parseJiraBoardAllowlist("455, 455, abc, 0, -1, 12")).toEqual([455, 12]);
  });

  it("accepts semicolons and newlines", () => {
    expect(parseJiraBoardAllowlist("1;2\n3")).toEqual([1, 2, 3]);
  });
});

describe("filterJiraBoardsByAllowlist", () => {
  const boards = [
    { id: 1, name: "A" },
    { id: 2, name: "B" },
    { id: 3, name: "C" },
  ];

  it("returns all boards when allowlist is empty", () => {
    expect(filterJiraBoardsByAllowlist(boards, [])).toEqual(boards);
  });

  it("filters by id", () => {
    expect(filterJiraBoardsByAllowlist(boards, [2, 9])).toEqual([{ id: 2, name: "B" }]);
  });
});
