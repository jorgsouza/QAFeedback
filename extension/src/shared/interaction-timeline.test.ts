/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  signatureDialogTitles,
  summarizeClickTarget,
  summarizeFormFieldTimeline,
  summarizeKeydownTimeline,
  summarizeSubmitTarget,
  summarizeTabSectionSelection,
} from "./interaction-timeline";

describe("interaction-timeline", () => {
  it("summarizeClickTarget prefers data-testid", () => {
    const el = document.createElement("button");
    el.setAttribute("data-testid", "submit-refund");
    el.textContent = "Confirmar";
    expect(summarizeClickTarget(el)).toBe('button[data-testid="submit-refund"]');
  });

  it("summarizeClickTarget describes role=tab with aria-label", () => {
    const el = document.createElement("div");
    el.setAttribute("role", "tab");
    el.setAttribute("aria-label", "Notificações");
    expect(summarizeClickTarget(el)).toContain("aba");
    expect(summarizeClickTarget(el)).toContain("Notificações");
  });

  it("summarizeClickTarget prefers aria-label on button without testid", () => {
    const el = document.createElement("button");
    el.setAttribute("aria-label", "Fechar painel");
    el.textContent = "×";
    expect(summarizeClickTarget(el)).toContain("aria-label");
    expect(summarizeClickTarget(el)).toContain("Fechar painel");
  });

  it("summarizeTabSectionSelection reads selected tab", () => {
    document.body.innerHTML =
      '<div role="tablist"><button role="tab" aria-selected="false">A</button><button role="tab" aria-selected="true" id="t-b">Relatos</button></div>';
    expect(summarizeTabSectionSelection(document)).toContain("Relatos");
  });

  it("signatureDialogTitles joins visible dialog labels", () => {
    document.body.innerHTML =
      '<div role="dialog" aria-modal="true" aria-label="Confirmar exclusão"></div>';
    expect(signatureDialogTitles(document)).toContain("Confirmar exclusão");
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
