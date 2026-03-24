import {
  buildHarRoot,
  harToJsonString,
  headersRecordToPairs,
  mergeHeaderPairs,
  redactHarRoot,
  type HarCaptureRecord,
  type HarHeader,
} from "../shared/network-har";

type Rec = {
  requestId: string;
  url: string;
  method: string;
  headers: HarHeader[];
  hasPostData?: boolean;
  postData?: string;
  postDataContentType?: string;
  monoReq?: number;
  wallReqMs?: number;
  monoRes?: number;
  monoFin?: number;
  status?: number;
  statusText?: string;
  mimeType?: string;
  resHeaders: HarHeader[];
  failed?: boolean;
  failText?: string;
  canceled?: boolean;
  body?: string;
  body64?: boolean;
};

function dbgAttach(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      const err = chrome.runtime.lastError;
      if (err?.message) reject(new Error(err.message));
      else resolve();
    });
  });
}

function dbgDetach(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => resolve());
  });
}

function dbgSend<T>(tabId: number, method: string, commandParams?: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, commandParams ?? {}, (result) => {
      const err = chrome.runtime.lastError;
      if (err?.message) reject(new Error(err.message));
      else resolve(result as T);
    });
  });
}

export class NetworkCaptureSession {
  readonly tabId: number;
  readonly records = new Map<string, Rec>();
  pageStartWallMs: number;
  attached = false;

  constructor(tabId: number) {
    this.tabId = tabId;
    this.pageStartWallMs = Date.now();
  }

  onCdpEvent(method: string, params: Record<string, unknown>): void {
    switch (method) {
      case "Network.requestWillBeSent":
        this.onRequestWillBeSent(params);
        break;
      case "Network.requestWillBeSentExtraInfo":
        this.onRequestExtra(params);
        break;
      case "Network.responseReceived":
        this.onResponseReceived(params);
        break;
      case "Network.loadingFinished":
        this.onLoadingFinished(params);
        break;
      case "Network.loadingFailed":
        this.onLoadingFailed(params);
        break;
      default:
        break;
    }
  }

  private getOrCreate(requestId: string): Rec {
    let r = this.records.get(requestId);
    if (!r) {
      r = {
        requestId,
        url: "",
        method: "GET",
        headers: [],
        resHeaders: [],
      };
      this.records.set(requestId, r);
    }
    return r;
  }

  private onRequestWillBeSent(p: Record<string, unknown>): void {
    const requestId = p.requestId as string;
    const request = p.request as
      | {
          url?: string;
          method?: string;
          headers?: Record<string, string>;
          postData?: string;
          hasPostData?: boolean;
        }
      | undefined;
    if (!requestId || !request?.url) return;

    const r = this.getOrCreate(requestId);
    r.url = request.url;
    r.method = (request.method ?? "GET").toUpperCase();
    r.headers = headersRecordToPairs(request.headers);
    if (request.hasPostData) r.hasPostData = true;
    if (typeof request.postData === "string") r.postData = request.postData;

    const ct = r.headers.find((h) => h.name.toLowerCase() === "content-type");
    if (ct?.value) r.postDataContentType = ct.value.split(";")[0]?.trim();

    r.monoReq = typeof p.timestamp === "number" ? p.timestamp : undefined;
    if (typeof p.wallTime === "number" && Number.isFinite(p.wallTime)) {
      r.wallReqMs = Math.round(p.wallTime * 1000);
    } else if (r.monoReq != null) {
      r.wallReqMs = Date.now();
    }
  }

  private onRequestExtra(p: Record<string, unknown>): void {
    const requestId = p.requestId as string;
    const headers = (p as { headers?: Record<string, string> }).headers;
    if (!requestId || !headers) return;
    const r = this.getOrCreate(requestId);
    r.headers = mergeHeaderPairs(r.headers, headersRecordToPairs(headers));
  }

  private onResponseReceived(p: Record<string, unknown>): void {
    const requestId = p.requestId as string;
    const response = p.response as
      | {
          status?: number;
          statusText?: string;
          mimeType?: string;
          headers?: Record<string, string>;
          fromDiskCache?: boolean;
        }
      | undefined;
    if (!requestId || !response) return;

    const r = this.getOrCreate(requestId);
    r.monoRes = typeof p.timestamp === "number" ? p.timestamp : r.monoRes;
    r.status = response.status;
    r.statusText = response.statusText ?? "";
    r.mimeType = response.mimeType ?? "x-unknown";
    r.resHeaders = headersRecordToPairs(response.headers);
  }

  private onLoadingFinished(p: Record<string, unknown>): void {
    const requestId = p.requestId as string;
    if (!requestId) return;
    const r = this.records.get(requestId);
    if (!r) return;
    r.monoFin = typeof p.timestamp === "number" ? p.timestamp : r.monoFin;
  }

  private onLoadingFailed(p: Record<string, unknown>): void {
    const requestId = p.requestId as string;
    if (!requestId) return;
    const r = this.getOrCreate(requestId);
    r.failed = true;
    r.failText = typeof p.errorText === "string" ? p.errorText : "failed";
    r.canceled = Boolean(p.canceled);
    r.monoFin = typeof p.timestamp === "number" ? p.timestamp : r.monoFin;
    if (r.status == null) {
      r.status = 0;
      r.statusText = r.canceled ? "canceled" : r.failText;
    }
  }

  async attach(): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await dbgAttach(this.tabId);
      await dbgSend(this.tabId, "Network.enable", {});
      this.attached = true;
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly =
        /another debugger|already attached|devtools/i.test(msg)
          ? "Outro depurador já está ligado a esta aba (ex.: DevTools). Feche o DevTools nesta aba e tente de novo."
          : msg || "Não foi possível iniciar a captura de rede.";
      return { ok: false, message: friendly };
    }
  }

  async detachSilently(): Promise<void> {
    if (!this.attached) return;
    this.attached = false;
    await dbgDetach(this.tabId);
  }

  async finalizeHar(): Promise<{ json: string; entryCount: number }> {
    const sorted = [...this.records.values()]
      .filter((r) => Boolean(r.url))
      .sort((a, b) => (a.monoReq ?? 0) - (b.monoReq ?? 0));

    for (const r of sorted) {
      if (r.hasPostData && r.postData === undefined) {
        try {
          const pd = await dbgSend<{ postData?: string }>(this.tabId, "Network.getRequestPostData", {
            requestId: r.requestId,
          });
          if (typeof pd?.postData === "string") r.postData = pd.postData;
        } catch {
          /* sem POST body */
        }
      }
      if (!r.failed && r.status != null && r.status > 0) {
        try {
          const b = await dbgSend<{ body: string; base64Encoded: boolean }>(
            this.tabId,
            "Network.getResponseBody",
            { requestId: r.requestId },
          );
          r.body = b.body;
          r.body64 = b.base64Encoded;
        } catch {
          /* sem corpo (ex.: redirect sem body) */
        }
      }
    }

    const entries: HarCaptureRecord[] = sorted.map((r) => {
      const t0 = r.monoReq ?? 0;
      const t1 = r.monoFin ?? r.monoRes ?? t0;
      const timeMs = Math.max(0, Math.round((t1 - t0) * 1000));
      const wallMs = r.wallReqMs ?? this.pageStartWallMs;

      const postMime = r.postDataContentType?.trim() || "application/octet-stream";
      const reqPost =
        r.postData !== undefined && r.postData !== ""
          ? { mimeType: postMime, text: r.postData }
          : undefined;

      const status = r.status ?? (r.failed ? 0 : 200);
      const statusText = r.statusText ?? (r.failed ? r.failText ?? "Error" : "OK");
      const mime = r.mimeType ?? "x-unknown";

      const rec: HarCaptureRecord = {
        startedDateTime: new Date(wallMs).toISOString(),
        timeMs,
        method: r.method,
        url: r.url,
        requestHeaders: r.headers,
        requestPostData: reqPost,
        responseStatus: status,
        responseStatusText: statusText,
        responseHeaders: r.resHeaders,
        responseMimeType: mime,
      };
      if (r.body !== undefined) {
        rec.responseBodyText = r.body;
        if (r.body64) rec.responseEncoding = "base64";
      }
      if (r.failed) {
        rec.comment = r.canceled ? "Request canceled" : `Request failed: ${r.failText ?? ""}`;
      }
      return rec;
    });

    const pageStarted = new Date(this.pageStartWallMs).toISOString();
    const har = buildHarRoot({ entries, pageStartedDateTime: pageStarted });
    redactHarRoot(har);
    return { json: harToJsonString(har), entryCount: entries.length };
  }
}

let activeSession: NetworkCaptureSession | null = null;

let listenersInstalled = false;

function ensureListeners(): void {
  if (listenersInstalled) return;
  listenersInstalled = true;

  chrome.debugger.onEvent.addListener((source, method, params) => {
    const s = activeSession;
    if (!s || s.tabId !== source.tabId) return;
    s.onCdpEvent(method, params as Record<string, unknown>);
  });

  chrome.debugger.onDetach.addListener((source, _reason) => {
    const s = activeSession;
    if (!s || s.tabId !== source.tabId) return;
    s.attached = false;
    activeSession = null;
  });
}

export async function startNetworkDiagnosticForTab(
  tabId: number,
): Promise<{ ok: boolean; message?: string; active: boolean }> {
  ensureListeners();

  if (activeSession?.tabId === tabId && activeSession.attached) {
    return { ok: true, active: true };
  }

  if (activeSession) {
    await activeSession.detachSilently();
    activeSession = null;
  }

  const session = new NetworkCaptureSession(tabId);
  const r = await session.attach();
  if (!r.ok) {
    return { ok: false, message: r.message, active: false };
  }

  activeSession = session;
  return { ok: true, active: true };
}

export async function stopNetworkDiagnosticForTab(tabId: number): Promise<void> {
  if (activeSession?.tabId !== tabId) return;
  await activeSession.detachSilently();
  activeSession = null;
}

/**
 * Gera o HAR, desliga o depurador e limpa a sessão. Só actua se `tabId` for a aba em captura.
 */
export async function consumeNetworkHarForTab(
  tabId: number,
): Promise<{ base64: string; fileName: string; entryCount: number } | null> {
  if (activeSession?.tabId !== tabId) return null;

  const session = activeSession;
  activeSession = null;

  let json: string;
  let entryCount: number;
  try {
    const r = await session.finalizeHar();
    json = r.json;
    entryCount = r.entryCount;
  } finally {
    await session.detachSilently();
  }

  if (entryCount === 0) {
    return null;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `qa-feedback-network-${stamp}.har`;
  const base64 = utf8JsonToBase64(json);

  return { base64, fileName, entryCount };
}

function utf8JsonToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
