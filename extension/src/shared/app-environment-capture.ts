/**
 * PRD-011 Fase 3 — captura best-effort de metadados da aplicação (build, ambiente, tenant, flags).
 *
 * Fontes: meta tags, alguns `window.*` conhecidos, `__NEXT_DATA__.buildId`, `__APP_CONFIG__` (só chaves
 * permitidas e valores primitivos), e localStorage/sessionStorage com **allowlist** explícita
 * (nunca dump completo de storage).
 */

import { CAPTURE_LIMITS } from "./context-limits";
import { truncate } from "./sanitizer";
import type { AppEnvironmentKeyValueV1, AppEnvironmentSnapshotV1 } from "./types";

/**
 * Chaves permitidas para `localStorage` / `sessionStorage`. Outras chaves são ignoradas por defeito.
 * Adicionar entradas aqui (e documentar) em vez de ler storage em massa.
 */
export const APP_ENV_STORAGE_KEYS_ALLOWLIST = [
  "buildId",
  "build-id",
  "build_id",
  "release",
  "app-release",
  "appVersion",
  "app-version",
  "environment",
  "app-environment",
  "tenant",
  "tenantId",
  "tenant-id",
  "commit",
  "commitSha",
  "commit-sha",
  "role",
  "user-role",
] as const;

function clipField(s: string): string {
  return truncate(s.trim(), CAPTURE_LIMITS.appEnvFieldMax);
}

function clipCommit(s: string): string {
  return truncate(s.trim(), CAPTURE_LIMITS.appEnvCommitMax);
}

function clipFlagKey(s: string): string {
  return truncate(s.trim(), CAPTURE_LIMITS.appEnvFlagKeyMax);
}

function clipFlagValue(s: string): string {
  return truncate(s.trim(), CAPTURE_LIMITS.appEnvFlagValueMax);
}

function assignScalarFirstWins(
  acc: AppEnvironmentSnapshotV1,
  key: keyof AppEnvironmentSnapshotV1,
  value: string | undefined,
): void {
  if (!value?.trim()) return;
  if (key === "featureFlags" || key === "experiments") return;
  const cur = acc[key];
  if (cur != null && String(cur).length > 0) return;
  (acc as Record<string, unknown>)[key] = value;
}

function mergeFlagLists(
  acc: AppEnvironmentSnapshotV1,
  field: "featureFlags" | "experiments",
  incoming: AppEnvironmentKeyValueV1[],
): void {
  if (!incoming.length) return;
  const map = new Map<string, string>();
  for (const x of acc[field] ?? []) {
    map.set(x.key, x.value);
  }
  for (const x of incoming) {
    if (map.size >= CAPTURE_LIMITS.appEnvFlagsMax) break;
    const k = clipFlagKey(x.key);
    if (!k || map.has(k)) continue;
    map.set(k, clipFlagValue(x.value));
  }
  acc[field] = [...map.entries()].map(([key, value]) => ({ key, value }));
}

function mergePartials(parts: AppEnvironmentSnapshotV1[]): AppEnvironmentSnapshotV1 {
  const out: AppEnvironmentSnapshotV1 = {};
  for (const p of parts) {
    const keys: (keyof AppEnvironmentSnapshotV1)[] = [
      "appName",
      "environmentName",
      "buildId",
      "release",
      "commitSha",
      "tenant",
      "role",
    ];
    for (const k of keys) {
      assignScalarFirstWins(out, k, p[k] as string | undefined);
    }
    if (p.featureFlags?.length) mergeFlagLists(out, "featureFlags", p.featureFlags);
    if (p.experiments?.length) mergeFlagLists(out, "experiments", p.experiments);
  }
  return out;
}

function collectFromMeta(doc: Document): AppEnvironmentSnapshotV1 {
  const out: AppEnvironmentSnapshotV1 = {};
  const flagPairs: AppEnvironmentKeyValueV1[] = [];
  const expPairs: AppEnvironmentKeyValueV1[] = [];

  const nodes = doc.querySelectorAll("meta[name], meta[property]");
  for (const node of nodes) {
    const el = node as HTMLMetaElement;
    const rawName = (el.getAttribute("name") || el.getAttribute("property") || "").trim().toLowerCase();
    const content = el.getAttribute("content")?.trim();
    if (!rawName || !content) continue;

    if (
      rawName === "application-name" ||
      rawName === "apple-mobile-web-app-title" ||
      rawName === "og:site_name"
    ) {
      assignScalarFirstWins(out, "appName", clipField(content));
      continue;
    }
    if (
      rawName === "environment" ||
      rawName === "app-environment" ||
      rawName === "sentry-environment" ||
      rawName === "deployment-environment"
    ) {
      assignScalarFirstWins(out, "environmentName", clipField(content));
      continue;
    }
    if (rawName === "build-id" || rawName === "buildid" || rawName === "version-build") {
      assignScalarFirstWins(out, "buildId", clipField(content));
      continue;
    }
    if (
      rawName === "release" ||
      rawName === "app-version" ||
      rawName === "release-version" ||
      rawName === "version"
    ) {
      assignScalarFirstWins(out, "release", clipField(content));
      continue;
    }
    if (
      rawName === "commit" ||
      rawName === "git-commit" ||
      rawName === "git-sha" ||
      rawName === "commit-sha"
    ) {
      assignScalarFirstWins(out, "commitSha", clipCommit(content));
      continue;
    }
    if (rawName === "tenant" || rawName === "tenant-id") {
      assignScalarFirstWins(out, "tenant", clipField(content));
      continue;
    }
    if (rawName === "role" || rawName === "user-role") {
      assignScalarFirstWins(out, "role", clipField(content));
      continue;
    }
    if (rawName.startsWith("feature-flag-")) {
      const key = clipFlagKey(rawName.slice("feature-flag-".length));
      if (key) flagPairs.push({ key, value: clipFlagValue(content) });
      continue;
    }
    if (rawName.startsWith("experiment-")) {
      const key = clipFlagKey(rawName.slice("experiment-".length));
      if (key) expPairs.push({ key, value: clipFlagValue(content) });
    }
  }

  if (flagPairs.length) mergeFlagLists(out, "featureFlags", flagPairs);
  if (expPairs.length) mergeFlagLists(out, "experiments", expPairs);
  return stripEmptyCollections(out);
}

function stripEmptyCollections(s: AppEnvironmentSnapshotV1): AppEnvironmentSnapshotV1 {
  const o = { ...s };
  if (!o.featureFlags?.length) delete o.featureFlags;
  if (!o.experiments?.length) delete o.experiments;
  return o;
}

const WINDOW_STRING_GLOBALS: { key: string; field: keyof AppEnvironmentSnapshotV1 }[] = [
  { key: "__BUILD_ID__", field: "buildId" },
  { key: "__RELEASE__", field: "release" },
  { key: "__VERSION__", field: "release" },
  { key: "__APP_VERSION__", field: "release" },
  { key: "__COMMIT_SHA__", field: "commitSha" },
  { key: "__GIT_SHA__", field: "commitSha" },
];

function collectWindowStringGlobals(win: Window): AppEnvironmentSnapshotV1 {
  const out: AppEnvironmentSnapshotV1 = {};
  const w = win as unknown as Record<string, unknown>;
  for (const { key, field } of WINDOW_STRING_GLOBALS) {
    const v = w[key];
    if (typeof v !== "string" || !v.trim()) continue;
    const clipped =
      field === "commitSha" ? clipCommit(v) : clipField(v);
    assignScalarFirstWins(out, field, clipped);
  }
  return out;
}

function collectFromNextData(win: Window): AppEnvironmentSnapshotV1 {
  const out: AppEnvironmentSnapshotV1 = {};
  try {
    const w = win as unknown as Record<string, unknown>;
    const nd = w["__NEXT_DATA__"];
    if (!nd || typeof nd !== "object" || nd === null) return out;
    const buildId = (nd as Record<string, unknown>).buildId;
    if (typeof buildId === "string" && buildId.trim()) {
      assignScalarFirstWins(out, "buildId", clipField(buildId));
    }
  } catch {
    /* ignore */
  }
  return out;
}

const APP_CONFIG_SCALAR_KEYS: Record<string, keyof AppEnvironmentSnapshotV1> = {
  appName: "appName",
  applicationName: "appName",
  name: "appName",
  environment: "environmentName",
  environmentName: "environmentName",
  env: "environmentName",
  buildId: "buildId",
  build: "buildId",
  release: "release",
  version: "release",
  commit: "commitSha",
  commitSha: "commitSha",
  gitSha: "commitSha",
  tenant: "tenant",
  role: "role",
};

function readPrimitiveString(v: unknown): string | undefined {
  if (typeof v === "boolean" || typeof v === "number") return clipField(String(v));
  if (typeof v === "string" && v.trim()) return clipField(v);
  return undefined;
}

function readAppConfigLikeObject(obj: Record<string, unknown>): AppEnvironmentSnapshotV1 {
  const out: AppEnvironmentSnapshotV1 = {};
  for (const [rawKey, field] of Object.entries(APP_CONFIG_SCALAR_KEYS)) {
    const s = readPrimitiveString(obj[rawKey]);
    if (!s) continue;
    const clipped = field === "commitSha" ? clipCommit(s) : clipField(s);
    assignScalarFirstWins(out, field, clipped);
  }
  const ff = obj.featureFlags;
  if (ff && typeof ff === "object" && !Array.isArray(ff)) {
    const pairs: AppEnvironmentKeyValueV1[] = [];
    for (const [k, val] of Object.entries(ff)) {
      const ks = clipFlagKey(k);
      if (!ks) continue;
      const vs = readPrimitiveString(val);
      if (!vs) continue;
      pairs.push({ key: ks, value: clipFlagValue(vs) });
      if (pairs.length >= CAPTURE_LIMITS.appEnvFlagsMax) break;
    }
    if (pairs.length) mergeFlagLists(out, "featureFlags", pairs);
  }
  const ex = obj.experiments;
  if (ex && typeof ex === "object" && !Array.isArray(ex)) {
    const pairs: AppEnvironmentKeyValueV1[] = [];
    for (const [k, val] of Object.entries(ex)) {
      const ks = clipFlagKey(k);
      if (!ks) continue;
      const vs = readPrimitiveString(val);
      if (!vs) continue;
      pairs.push({ key: ks, value: clipFlagValue(vs) });
      if (pairs.length >= CAPTURE_LIMITS.appEnvFlagsMax) break;
    }
    if (pairs.length) mergeFlagLists(out, "experiments", pairs);
  }
  return stripEmptyCollections(out);
}

function collectFromAppConfig(win: Window): AppEnvironmentSnapshotV1 {
  try {
    const w = win as unknown as Record<string, unknown>;
    const cfg = w["__APP_CONFIG__"];
    if (!cfg || typeof cfg !== "object" || cfg === null) return {};
    return readAppConfigLikeObject(cfg as Record<string, unknown>);
  } catch {
    return {};
  }
}

/** Só nível topo — evita serializar estado Redux completo. */
function collectFromInitialState(win: Window): AppEnvironmentSnapshotV1 {
  try {
    const w = win as unknown as Record<string, unknown>;
    const st = w["__INITIAL_STATE__"];
    if (!st || typeof st !== "object" || st === null) return {};
    return readAppConfigLikeObject(st as Record<string, unknown>);
  } catch {
    return {};
  }
}

function storageRawKeyToField(key: string): keyof AppEnvironmentSnapshotV1 | null {
  const k = key.toLowerCase().replace(/_/g, "-");
  if (k === "buildid" || k === "build-id") return "buildId";
  if (k === "release" || k === "app-release" || k === "appversion" || k === "app-version") return "release";
  if (k === "environment" || k === "app-environment") return "environmentName";
  if (k === "tenant" || k === "tenantid" || k === "tenant-id") return "tenant";
  if (k === "commit" || k === "commitsha" || k === "commit-sha") return "commitSha";
  if (k === "role" || k === "user-role") return "role";
  return null;
}

function collectFromStorage(win: Window): AppEnvironmentSnapshotV1 {
  const out: AppEnvironmentSnapshotV1 = {};
  try {
    for (const key of APP_ENV_STORAGE_KEYS_ALLOWLIST) {
      const field = storageRawKeyToField(key);
      if (!field || field === "featureFlags" || field === "experiments") continue;
      let raw: string | null = null;
      try {
        raw = win.localStorage?.getItem(key) ?? win.sessionStorage?.getItem(key) ?? null;
      } catch {
        raw = null;
      }
      if (!raw?.trim()) continue;
      const clipped = field === "commitSha" ? clipCommit(raw) : clipField(raw);
      assignScalarFirstWins(out, field, clipped);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function snapshotHasContent(s: AppEnvironmentSnapshotV1): boolean {
  return Boolean(
    s.appName ||
      s.environmentName ||
      s.buildId ||
      s.release ||
      s.commitSha ||
      s.tenant ||
      s.role ||
      (s.featureFlags?.length ?? 0) > 0 ||
      (s.experiments?.length ?? 0) > 0,
  );
}

/**
 * Lê `document`, `window` e storage (allowlist). Devolve `undefined` se não houver nenhum sinal.
 */
export function captureAppEnvironment(win: Window | null | undefined): AppEnvironmentSnapshotV1 | undefined {
  if (!win?.document) return undefined;

  const fromMeta = collectFromMeta(win.document);
  const merged = mergePartials([
    fromMeta,
    collectWindowStringGlobals(win),
    collectFromNextData(win),
    collectFromAppConfig(win),
    collectFromInitialState(win),
    collectFromStorage(win),
  ]);

  if (!snapshotHasContent(merged)) return undefined;
  return stripEmptyCollections(merged);
}
