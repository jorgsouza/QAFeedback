import type { ExtensionSettings } from "./types";

const KEY = "qaFeedbackSettings";

export const DEFAULT_ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

export const emptySettings = (): ExtensionSettings => ({
  githubToken: "",
  owner: "",
  repo: "",
  repos: [],
  allowedHosts: [...DEFAULT_ALLOWED_HOSTS],
  iaServiceBaseUrl: "",
  iaServiceApiKey: "",
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
    iaServiceBaseUrl: typeof raw.iaServiceBaseUrl === "string" ? raw.iaServiceBaseUrl : "",
    iaServiceApiKey: typeof raw.iaServiceApiKey === "string" ? raw.iaServiceApiKey : "",
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}
