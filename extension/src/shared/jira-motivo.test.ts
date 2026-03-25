import { describe, expect, it } from "vitest";
import { jiraMotivoCustomFieldApiValue } from "./jira-motivo";

describe("jiraMotivoCustomFieldApiValue", () => {
  it("serializes as multi-select / checkboxes array for Jira REST v3", () => {
    expect(jiraMotivoCustomFieldApiValue("Design")).toEqual([{ value: "Design" }]);
  });
});
