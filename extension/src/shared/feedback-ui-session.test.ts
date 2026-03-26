/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  buildTabSnapshotV2,
  parseTabSnapshotFromStoredValue,
  readTabSnapshotFromSession,
  writeTabSnapshotToSession,
} from "./feedback-ui-session";

beforeEach(() => {
  sessionStorage.clear();
});

describe("feedback-ui-session v2", () => {
  it("round-trips snapshot via sessionStorage", () => {
    const snap = buildTabSnapshotV2({
      open: true,
      sheetCollapsed: false,
      repoIndex: 2,
      selectedJiraBoardId: "42",
      panelTab: "preview",
      form: {
        title: "T",
        whatHappened: "W",
        includeTechnicalContext: true,
        sendToGitHub: true,
        sendToJira: false,
        jiraMotivoAbertura: "",
      },
    });
    writeTabSnapshotToSession(snap);
    expect(readTabSnapshotFromSession()).toEqual(snap);
  });

  it("parseTabSnapshotFromStoredValue migrates v1", () => {
    expect(
      parseTabSnapshotFromStoredValue({
        v: 1,
        open: true,
        sheetCollapsed: true,
        minimized: false,
      }),
    ).toEqual({
      v: 2,
      open: true,
      sheetCollapsed: true,
      minimized: false,
    });
  });

  it("returns null for invalid stored value", () => {
    expect(parseTabSnapshotFromStoredValue(null)).toBeNull();
    expect(parseTabSnapshotFromStoredValue({ v: 9 })).toBeNull();
  });
});
