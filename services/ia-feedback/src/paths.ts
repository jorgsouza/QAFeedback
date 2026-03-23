import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Raiz do repositório QAFeedback (…/services/ia-feedback/src → sobe 3 níveis). */
export function repoRootFromHere(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..");
}

export function rootEnvPath(): string {
  return resolve(repoRootFromHere(), ".env");
}
