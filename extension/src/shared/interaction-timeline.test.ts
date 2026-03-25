/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  summarizeClickTarget,
  summarizeFormFieldTimeline,
  summarizeKeydownTimeline,
  summarizeSubmitTarget,
} from "./interaction-timeline";

describe("interaction-timeline", () => {
  it("summarizeClickTarget prefers data-testid", () => {
    const el = document.createElement("button");
    el.setAttribute("data-testid", "submit-refund");
    el.textContent = "Confirmar";
    expect(summarizeClickTarget(el)).toBe('button[data-testid="submit-refund"]');
  });

  it("summarizeFormFieldTimeline masks password inputs", () => {
    const el = document.createElement("input");
    el.type = "password";
    el.name = "pwd";
    expect(summarizeFormFieldTimeline(el)).toContain("sensível");
  });

  it("summarizeFormFieldTimeline describes checkbox", () => {
    const el = document.createElement("input");
    el.type = "checkbox";
    el.name = "accept";
    el.checked = true;
    expect(summarizeFormFieldTimeline(el)).toContain("Checkbox");
    expect(summarizeFormFieldTimeline(el)).toContain("marcado");
  });

  it("summarizeSubmitTarget includes form id when present", () => {
    const f = document.createElement("form");
    f.id = "login-form";
    expect(summarizeSubmitTarget(f)).toContain("#login-form");
    expect(summarizeSubmitTarget(f)).toContain("formulário");
  });

  it("summarizeKeydownTimeline only tracks a few keys", () => {
    expect(summarizeKeydownTimeline("Enter")).toBe("Tecla Enter");
    expect(summarizeKeydownTimeline("a")).toBeNull();
  });
});
