import type { ExtensionSettings } from "./types";

const KEY = "qaFeedbackSettings";

export const DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

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
    fullNetworkDiagnostic: false,
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
    fullNetworkDiagnostic: raw.fullNetworkDiagnostic === true,
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}
