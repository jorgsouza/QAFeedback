/** Limites para anexos no modal → Jira (mensagem ao SW em base64). */
export const JIRA_FEEDBACK_MAX_IMAGES = 8;
export const JIRA_FEEDBACK_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function safeImageFileNameForJira(name: string): string {
  const trimmed = name.trim() || "screenshot.png";
  const safe = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return safe || "screenshot.png";
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("read"));
    r.readAsDataURL(file);
  });
}
