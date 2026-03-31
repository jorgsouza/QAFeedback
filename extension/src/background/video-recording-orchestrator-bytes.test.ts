import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { uint8ArrayToBase64Latin1 } from "../shared/base64-to-bytes";
import {
  routeOffscreenVideoBytesChunk,
  routeOffscreenVideoBytesCommit,
} from "./video-recording-orchestrator";

function chunkMsg(
  sessionId: string,
  tabId: number,
  index: number,
  total: number,
  bytes: Uint8Array,
): Record<string, unknown> {
  return {
    type: "QAF_OFFSCREEN_VIDEO_BYTES_CHUNK",
    sessionId,
    tabId,
    index,
    total,
    base64: uint8ArrayToBase64Latin1(bytes),
  };
}

describe("offscreen video bytes accumulator", () => {
  const tabId = 4242;

  beforeEach(() => {
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects commit when a middle chunk index is missing", async () => {
    const sessionId = "sess-hole";
    routeOffscreenVideoBytesChunk(chunkMsg(sessionId, tabId, 0, 3, new Uint8Array([1, 2])));
    routeOffscreenVideoBytesChunk(chunkMsg(sessionId, tabId, 2, 3, new Uint8Array([3, 4])));
    await expect(
      routeOffscreenVideoBytesCommit({
        type: "QAF_OFFSCREEN_VIDEO_BYTES_COMMIT",
        sessionId,
        tabId,
        fileName: "t.webm",
        mimeType: "video/webm",
        durationMs: 0,
        sizeBytes: 1,
        byteLength: 4,
      }),
    ).rejects.toThrow(/Partes em falta/i);
  });

  it("accepts legacy bytes field as Uint8Array", async () => {
    const sessionId = "sess-legacy-bytes";
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);
    routeOffscreenVideoBytesChunk({
      type: "QAF_OFFSCREEN_VIDEO_BYTES_CHUNK",
      sessionId,
      tabId,
      index: 0,
      total: 1,
      bytes: new Uint8Array(bytes),
    });
    await routeOffscreenVideoBytesCommit({
      type: "QAF_OFFSCREEN_VIDEO_BYTES_COMMIT",
      sessionId,
      tabId,
      fileName: "t.webm",
      mimeType: "video/webm",
      durationMs: 1,
      sizeBytes: 4,
      byteLength: 4,
    });
    expect(chrome.storage.session.set).toHaveBeenCalled();
  });

  it("stores WebM when all byte chunks present and length matches", async () => {
    const sessionId = "sess-ok";
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03, 0x04]);
    const mid = 3;
    const p0 = bytes.subarray(0, mid);
    const p1 = bytes.subarray(mid);
    routeOffscreenVideoBytesChunk(
      chunkMsg(sessionId, tabId, 0, 2, new Uint8Array(p0)),
    );
    routeOffscreenVideoBytesChunk(
      chunkMsg(sessionId, tabId, 1, 2, new Uint8Array(p1)),
    );
    await routeOffscreenVideoBytesCommit({
      type: "QAF_OFFSCREEN_VIDEO_BYTES_COMMIT",
      sessionId,
      tabId,
      fileName: "t.webm",
      mimeType: "video/webm",
      durationMs: 10,
      sizeBytes: bytes.byteLength,
      byteLength: bytes.byteLength,
    });
    expect(chrome.storage.session.set).toHaveBeenCalledTimes(1);
    const call = (chrome.storage.session.set as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    const key = `qafPendingVideoV1_tab_${tabId}`;
    const payload = call[key] as { v?: number; bytes?: Uint8Array };
    expect(payload?.v).toBe(3);
    expect(payload?.bytes instanceof Uint8Array).toBe(true);
    expect(Array.from(payload?.bytes?.slice(0, 4) ?? [])).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  });

  it("rejects when concatenated length does not match byteLength from offscreen", async () => {
    const sessionId = "sess-len";
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1]);
    routeOffscreenVideoBytesChunk(chunkMsg(sessionId, tabId, 0, 1, new Uint8Array(bytes)));
    await expect(
      routeOffscreenVideoBytesCommit({
        type: "QAF_OFFSCREEN_VIDEO_BYTES_COMMIT",
        sessionId,
        tabId,
        fileName: "t.webm",
        mimeType: "video/webm",
        durationMs: 0,
        sizeBytes: 5,
        byteLength: bytes.byteLength + 50,
      }),
    ).rejects.toThrow(/VIDEO_BYTE_LENGTH_MISMATCH|truncados/i);
  });
});
