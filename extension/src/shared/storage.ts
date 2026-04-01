import type { ExtensionSettings } from "./types";

const KEY = "qaFeedbackSettings";

export const DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "www.reclameaqui.com.br"];

/** PRD-012 — auto-stop da gravação viewport (30–90s). */
export const DEFAULT_VIEWPORT_RECORDING_MAX_SEC = 90;

export const emptySettings = (): ExtensionSettings => ({
  githubToken: "",
  owner: "",
  repo: "",
  repos: [],
  allowedHosts: [...DEFAULT_ALLOWED_HOSTS],
  jiraSiteUrl: "",
  jiraEmail: "",
  jiraApiToken: "",
  jiraProjectKey: "",
  jiraIssueTypeName: "Bug",
  jiraMotivoCustomFieldId: "",
  jiraSoftwareBoardId: "",
  jiraBoardAutoFields: [],
  jiraBoardFilterSelectFieldId: "",
    jiraBoardFilterSelectValue: "",
    fullNetworkDiagnostic: true,
    captureMode: "debug-interno",
    enableViewportRecording: true,
    viewportRecordingMaxSec: DEFAULT_VIEWPORT_RECORDING_MAX_SEC,
});

export async function loadSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(KEY);
  const raw = data[KEY] as Partial<ExtensionSettings> | undefined;
  if (!raw) return emptySettings();
  return {
    ...emptySettings(),
    ...raw,
    repos: Array.isArray(raw.repos) ? raw.repos : [],
    allowedHosts:
      Array.isArray(raw.allowedHosts) && raw.allowedHosts.length
        ? raw.allowedHosts
        : [...DEFAULT_ALLOWED_HOSTS],
    jiraSiteUrl: typeof raw.jiraSiteUrl === "string" ? raw.jiraSiteUrl : "",
    jiraEmail: typeof raw.jiraEmail === "string" ? raw.jiraEmail : "",
    jiraApiToken: typeof raw.jiraApiToken === "string" ? raw.jiraApiToken : "",
    jiraProjectKey: typeof raw.jiraProjectKey === "string" ? raw.jiraProjectKey : "",
    jiraIssueTypeName: typeof raw.jiraIssueTypeName === "string" ? raw.jiraIssueTypeName : "Bug",
    jiraMotivoCustomFieldId:
      typeof raw.jiraMotivoCustomFieldId === "string" ? raw.jiraMotivoCustomFieldId : "",
    jiraSoftwareBoardId:
      typeof raw.jiraSoftwareBoardId === "string" ? raw.jiraSoftwareBoardId : "",
    jiraBoardAutoFields: Array.isArray(raw.jiraBoardAutoFields)
      ? raw.jiraBoardAutoFields.filter(
          (x): x is { fieldId: string; set: unknown } =>
            Boolean(x && typeof (x as { fieldId?: string }).fieldId === "string"),
        )
      : [],
    jiraBoardFilterSelectFieldId:
      typeof raw.jiraBoardFilterSelectFieldId === "string" ? raw.jiraBoardFilterSelectFieldId : "",
    jiraBoardFilterSelectValue:
      typeof raw.jiraBoardFilterSelectValue === "string" ? raw.jiraBoardFilterSelectValue : "",
    fullNetworkDiagnostic: true,
    captureMode: "debug-interno",
    enableViewportRecording: true,
    viewportRecordingMaxSec: clampViewportRecordingMaxSec(raw.viewportRecordingMaxSec),
  };
}

function clampViewportRecordingMaxSec(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return DEFAULT_VIEWPORT_RECORDING_MAX_SEC;
  return Math.max(30, Math.min(90, Math.round(x)));
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const normalized: ExtensionSettings = {
    ...settings,
    fullNetworkDiagnostic: true,
    captureMode: "debug-interno",
    enableViewportRecording: true,
    viewportRecordingMaxSec: clampViewportRecordingMaxSec(settings.viewportRecordingMaxSec),
  };
  await chrome.storage.local.set({ [KEY]: normalized });
}
