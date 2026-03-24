/**
 * Web Speech API (Chrome: webkitSpeechRecognition). O áudio é processado pelo serviço do Chrome/Google.
 */

export type SpeechRecognitionField = "title" | "whatHappened";

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null;
};

type SpeechRecognitionErrorEventLike = { error: string };

export type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isChromeSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/**
 * Idioma BCP-47 para o reconhecedor.
 * O formulário é em português: usamos pt-BR por defeito, mesmo que o Chrome esteja em inglês.
 * Se o utilizador tiver português na lista de idiomas do browser (pt-BR, pt-PT, …), respeitamos o primeiro.
 */
export function pickSpeechRecognitionLang(): string {
  if (typeof navigator === "undefined") return "pt-BR";
  const list = [...(navigator.languages ?? []), navigator.language]
    .map((l) => (l ?? "").trim())
    .filter((l) => l.length > 0);
  for (const tag of list) {
    if (/^pt-/i.test(tag)) return tag;
    if (/^pt$/i.test(tag)) return "pt-BR";
  }
  return "pt-BR";
}

export function mergeTranscriptFromResultEvent(
  startSnapshot: string,
  accumulatedFinal: string,
  event: Pick<SpeechRecognitionResultEventLike, "resultIndex" | "results">,
): { accumulatedFinal: string; display: string } {
  let acc = accumulatedFinal;
  let interim = "";
  const { results, resultIndex } = event;
  for (let i = resultIndex; i < results.length; i++) {
    const r = results[i];
    const t = r[0]?.transcript ?? "";
    if (r.isFinal) acc += t;
    else interim += t;
  }
  return { accumulatedFinal: acc, display: startSnapshot + acc + interim };
}

export function speechRecognitionErrorMessage(code: string): string | null {
  switch (code) {
    case "not-allowed":
      return "Microfone negado. Permita o microfone para este sítio (ícone à esquerda da barra de endereço) ou nas definições do Chrome.";
    case "service-not-allowed":
      return "Reconhecimento de voz não permitido neste contexto.";
    case "network":
      return "Reconhecimento de voz: falha de rede (serviço do Chrome).";
    case "no-speech":
    case "aborted":
    case "audio-capture":
      return null;
    default:
      return `Reconhecimento de voz: ${code}`;
  }
}
