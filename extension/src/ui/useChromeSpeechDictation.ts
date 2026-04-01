import { useCallback, useEffect, useRef, useState } from "react";
import type { IssueFormState } from "../shared/types";
import {
  getSpeechRecognitionConstructor,
  isChromeSpeechRecognitionSupported,
  mergeTranscriptFromResultEvent,
  pickSpeechRecognitionLang,
  speechRecognitionErrorMessage,
  type SpeechRecognitionField,
  type SpeechRecognitionLike,
  type SpeechRecognitionResultEventLike,
} from "../shared/chrome-speech-dictation";

export type UseChromeSpeechDictation = {
  /** Campo em que o Chrome está a escutar, ou null. */
  listeningField: SpeechRecognitionField | null;
  /** API disponível neste browser (Chrome normalmente sim). */
  speechSupported: boolean;
  /** Contexto seguro (HTTPS) — necessário para microfone. */
  secureContext: boolean;
  /** Clicar no microfone: inicia/para reconhecimento; devolve true se usou voz, false para fallback (só foco). */
  toggleField: (field: SpeechRecognitionField) => boolean;
  /** Para imediatamente (ex.: fechar modal). */
  stop: () => void;
  /** Último aviso de erro de voz (curto). */
  speechError: string | null;
  clearSpeechError: () => void;
};

export function useChromeSpeechDictation(
  setForm: React.Dispatch<React.SetStateAction<IssueFormState>>,
  getForm: () => IssueFormState,
  options: { enabled: boolean },
): UseChromeSpeechDictation {
  const [listeningField, setListeningField] = useState<SpeechRecognitionField | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const accumulatedRef = useRef("");
  const startSnapshotRef = useRef("");
  const listeningFieldRef = useRef<SpeechRecognitionField | null>(null);

  const getFormRef = useRef(getForm);
  getFormRef.current = getForm;

  const stopInternal = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    listeningFieldRef.current = null;
    setListeningField(null);
    if (r) {
      r.onend = null;
      r.onerror = null;
      r.onresult = null;
      r.onstart = null;
      try {
        r.abort();
      } catch {
        try {
          r.stop();
        } catch {
          /* ignore */
        }
      }
    }
  }, []);

  const stop = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  const clearSpeechError = useCallback(() => setSpeechError(null), []);

  const toggleField = useCallback(
    (field: SpeechRecognitionField): boolean => {
      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor || typeof window === "undefined") return false;

      if (!window.isSecureContext) {
        setSpeechError("O reconhecimento de voz do Chrome precisa de página HTTPS.");
        return false;
      }

      if (listeningFieldRef.current === field && recognitionRef.current) {
        stopInternal();
        return true;
      }

      setSpeechError(null);
      stopInternal();

      const snap = getFormRef.current();
      const startVal = field === "title" ? snap.title : snap.whatHappened;
      startSnapshotRef.current = startVal;
      accumulatedRef.current = "";

      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = pickSpeechRecognitionLang();

      rec.onstart = () => {
        listeningFieldRef.current = field;
        setListeningField(field);
      };

      rec.onresult = (ev: SpeechRecognitionResultEventLike) => {
        const { accumulatedFinal, display } = mergeTranscriptFromResultEvent(
          startSnapshotRef.current,
          accumulatedRef.current,
          ev,
        );
        accumulatedRef.current = accumulatedFinal;
        setForm((f) =>
          field === "title" ? { ...f, title: display } : { ...f, whatHappened: display },
        );
      };

      rec.onerror = (ev) => {
        const msg = speechRecognitionErrorMessage(ev.error);
        if (msg) setSpeechError(msg);
      };

      rec.onend = () => {
        recognitionRef.current = null;
        listeningFieldRef.current = null;
        setListeningField(null);
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch {
        setSpeechError("Não foi possível iniciar o reconhecimento de voz.");
        recognitionRef.current = null;
        return false;
      }
      return true;
    },
    [setForm, stopInternal],
  );

  useEffect(() => {
    if (!options.enabled) stopInternal();
  }, [options.enabled, stopInternal]);

  useEffect(() => () => stopInternal(), [stopInternal]);

  const speechSupported = isChromeSpeechRecognitionSupported();
  const secureContext = typeof window !== "undefined" && window.isSecureContext;

  return {
    listeningField,
    speechSupported,
    secureContext,
    toggleField,
    stop,
    speechError,
    clearSpeechError,
  };
}
