import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergeTranscriptFromResultEvent,
  pickSpeechRecognitionLang,
  speechRecognitionErrorIsFatal,
  speechRecognitionErrorMessage,
} from "./chrome-speech-dictation";

describe("pickSpeechRecognitionLang", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to pt-BR when browser is English only", () => {
    vi.stubGlobal("navigator", { language: "en-US", languages: ["en-US", "en"] });
    expect(pickSpeechRecognitionLang()).toBe("pt-BR");
  });

  it("uses first Portuguese tag from languages", () => {
    vi.stubGlobal("navigator", { language: "en-US", languages: ["en-US", "pt-BR"] });
    expect(pickSpeechRecognitionLang()).toBe("pt-BR");
  });

  it("uses pt-PT when present", () => {
    vi.stubGlobal("navigator", { language: "pt-PT", languages: undefined });
    expect(pickSpeechRecognitionLang()).toBe("pt-PT");
  });

  it("maps bare pt to pt-BR", () => {
    vi.stubGlobal("navigator", { language: "pt", languages: undefined });
    expect(pickSpeechRecognitionLang()).toBe("pt-BR");
  });

  it("falls back to pt-BR when language list empty", () => {
    vi.stubGlobal("navigator", { language: "", languages: [] });
    expect(pickSpeechRecognitionLang()).toBe("pt-BR");
  });
});

describe("mergeTranscriptFromResultEvent", () => {
  it("appends final and interim segments", () => {
    const ev = {
      resultIndex: 0,
      results: {
        length: 2,
        0: { isFinal: true, 0: { transcript: "olá " } },
        1: { isFinal: false, 0: { transcript: "mun" } },
      },
    };
    const out = mergeTranscriptFromResultEvent("", "", ev);
    expect(out.accumulatedFinal).toBe("olá ");
    expect(out.display).toBe("olá mun");
  });

  it("accumulates across resultIndex", () => {
    const ev = {
      resultIndex: 1,
      results: {
        length: 2,
        0: { isFinal: true, 0: { transcript: "a" } },
        1: { isFinal: true, 0: { transcript: "b" } },
      },
    };
    const out = mergeTranscriptFromResultEvent("x", "a", ev);
    expect(out.accumulatedFinal).toBe("ab");
    expect(out.display).toBe("xab");
  });
});

describe("speechRecognitionErrorMessage", () => {
  it("maps not-allowed", () => {
    expect(speechRecognitionErrorMessage("not-allowed")).toContain("Microfone");
  });

  it("returns null for no-speech", () => {
    expect(speechRecognitionErrorMessage("no-speech")).toBeNull();
  });
});

describe("speechRecognitionErrorIsFatal", () => {
  it("treats permission and service errors as fatal", () => {
    expect(speechRecognitionErrorIsFatal("not-allowed")).toBe(true);
    expect(speechRecognitionErrorIsFatal("service-not-allowed")).toBe(true);
    expect(speechRecognitionErrorIsFatal("network")).toBe(true);
  });

  it("does not treat no-speech or aborted as fatal", () => {
    expect(speechRecognitionErrorIsFatal("no-speech")).toBe(false);
    expect(speechRecognitionErrorIsFatal("aborted")).toBe(false);
  });
});
