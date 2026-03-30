import { afterEach, describe, expect, it, vi } from "vitest";
import { pickWebmMimeTypeForMediaRecorder } from "./video-recording-mime";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pickWebmMimeTypeForMediaRecorder", () => {
  it("returns first supported candidate", () => {
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported(t: string) {
          return t === "video/webm;codecs=vp8,opus";
        }
      } as unknown as typeof MediaRecorder,
    );
    expect(pickWebmMimeTypeForMediaRecorder()).toBe("video/webm;codecs=vp8,opus");
  });

  it("returns empty when nothing supported", () => {
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return false;
        }
      } as unknown as typeof MediaRecorder,
    );
    expect(pickWebmMimeTypeForMediaRecorder()).toBe("");
  });
});
