/**
 * O ditado é sempre o do sistema operativo; não há API web para o iniciar.
 * Isto só gera instruções e deteta a plataforma para texto útil ao QA.
 */

export type DictationPlatform = "windows" | "mac" | "linux" | "chromeos" | "unknown";

export function detectDictationPlatform(): DictationPlatform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = (nav.userAgentData?.platform ?? navigator.platform ?? "").toLowerCase();

  if (p.includes("win") || ua.includes("Windows")) return "windows";
  if (p.includes("mac") || ua.includes("Mac OS")) return "mac";
  if (ua.includes("CrOS") || p.includes("chrome os")) return "chromeos";
  if (p.includes("linux") || ua.includes("Linux")) return "linux";
  return "unknown";
}

export function getNativeDictationHintLines(platform: DictationPlatform): string[] {
  switch (platform) {
    case "windows":
      return [
        "Clique no campo onde quer o texto (Título ou O que aconteceu).",
        "Prima Win + H para abrir o ditado por voz do Windows.",
        "Fale; o texto é inserido onde está o cursor. No Windows 11 o ditado também pode aparecer na barra de ferramentas de entrada.",
      ];
    case "mac":
      return [
        "Em Ajustes do Sistema → Teclado → Ditado, ative o Ditado se ainda não estiver.",
        "Clique no campo de texto e use o atalho do sistema (por exemplo duas vezes a tecla Fn, ou o que tiver definido em Teclado).",
        "O texto ditado aparece na posição do cursor.",
      ];
    case "chromeos":
      return [
        "Clique no campo de texto.",
        "No teclado virtual ou nas opções do Chromebook, use o microfone de ditado se estiver disponível.",
      ];
    case "linux":
      return [
        "Clique no campo de texto.",
        "Use o reconhecimento de voz ou ditado que o seu ambiente (GNOME, KDE, IBus, etc.) oferecer no teclado, se estiver configurado.",
      ];
    default:
      return [
        "Clique no campo Título ou O que aconteceu.",
        "Use o ditado ou entrada por voz integrado no seu sistema operativo ou teclado (por exemplo ditado no Windows ou no macOS).",
      ];
  }
}

/**
 * Frase do atalho/ação do SO (minúscula inicial; segue "Campo ativo — " ou "Depois ").
 * O ditado não pode ser iniciado por JavaScript — só focamos o campo.
 */
export function getDictationActionPhrase(platform: DictationPlatform): string {
  switch (platform) {
    case "windows":
      return "prima Win + H para abrir o ditado do Windows e falar.";
    case "mac":
      return "use o atalho de Ditado do macOS (ex.: Fn duas vezes, se estiver assim nas definições de Teclado).";
    case "chromeos":
      return "use o microfone de ditado no teclado do Chromebook, se existir.";
    case "linux":
      return "use o ditado ou voz do seu ambiente de trabalho, se estiver configurado.";
    default:
      return "use agora o atalho de ditado do seu sistema operativo.";
  }
}

/** Lembrete curto depois de focar o campo (o SO não permite iniciar ditado por JavaScript). */
export function getDictationPostFocusHint(platform: DictationPlatform): string {
  return `Campo ativo — ${getDictationActionPhrase(platform)}`;
}

/** Tooltip dos botões de microfone: focar campo + lembrar o passo seguinte no SO. */
export function getDictationMicTooltip(target: "title" | "what", platform: DictationPlatform): string {
  const place = target === "title" ? "o título" : "a descrição (O que aconteceu)";
  return `Focar ${place}. Depois ${getDictationActionPhrase(platform)}`;
}
