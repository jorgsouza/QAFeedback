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

  it("round-trips fabDismissed in snapshot", () => {
    const snap = buildTabSnapshotV2({
      open: false,
      sheetCollapsed: false,
      repoIndex: 0,
      selectedJiraBoardId: "",
      panelTab: "form",
      form: {
        title: "",
        whatHappened: "",
        includeTechnicalContext: true,
        sendToGitHub: true,
        sendToJira: false,
        jiraMotivoAbertura: "",
      },
      fabDismissed: true,
    });
    expect(snap.fabDismissed).toBe(true);
    writeTabSnapshotToSession(snap);
    expect(readTabSnapshotFromSession()?.fabDismissed).toBe(true);
  });
});
