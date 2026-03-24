import { EXTENSION_VERSION } from "./extension-version";

/** Nomes de cabeçalhos redigidos no HAR exportado (comparação case-insensitive). */
export const HAR_REDACTED_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
]);

export type HarHeader = { name: string; value: string };

export type HarCaptureRecord = {
  startedDateTime: string;
  timeMs: number;
  method: string;
  url: string;
  requestHeaders: HarHeader[];
  requestPostData?: { mimeType: string; text: string };
  responseStatus: number;
  responseStatusText: string;
  responseHeaders: HarHeader[];
  responseMimeType: string;
  responseBodyText?: string;
  responseEncoding?: "base64";
  comment?: string;
};

export type HarRoot = {
  log: {
    version: "1.2";
    creator: { name: string; version: string };
    pages: {
      startedDateTime: string;
      id: string;
      title: string;
      pageTimings: { onContentLoad: number; onLoad: number };
    }[];
    entries: unknown[];
  };
};

export function headerShouldRedact(name: string): boolean {
  return HAR_REDACTED_HEADER_NAMES.has(name.trim().toLowerCase());
}

export function redactHarRoot(har: HarRoot): void {
  const entries = har.log.entries as {
    request?: { headers?: HarHeader[] };
    response?: { headers?: HarHeader[] };
  }[];
  for (const e of entries) {
    for (const h of e.request?.headers ?? []) {
      if (headerShouldRedact(h.name)) h.value = "[REDACTED]";
    }
    for (const h of e.response?.headers ?? []) {
      if (headerShouldRedact(h.name)) h.value = "[REDACTED]";
    }
  }
}

export function headersRecordToPairs(raw: unknown): HarHeader[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, string>).map(([name, value]) => ({
    name,
    value: value === undefined || value === null ? "" : String(value),
  }));
}

export function mergeHeaderPairs(base: HarHeader[], extra: HarHeader[]): HarHeader[] {
  return [...base, ...extra];
}

export function queryStringFromUrl(url: string): HarHeader[] {
  try {
    const u = new URL(url);
    return [...u.searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

export function buildHarRoot(params: {
  entries: HarCaptureRecord[];
  pageStartedDateTime: string;
  pageTitle?: string;
}): HarRoot {
  const pageId = "page_1";
  const pages = [
    {
      startedDateTime: params.pageStartedDateTime,
      id: pageId,
      title: params.pageTitle ?? "",
      pageTimings: { onContentLoad: -1, onLoad: -1 },
    },
  ];

  const harEntries = params.entries.map((r) => {
    const reqHeaders = r.requestHeaders;
    const resHeaders = r.responseHeaders;
    const qs = queryStringFromUrl(r.url);
    const reqBodySize = r.requestPostData?.text
      ? new TextEncoder().encode(r.requestPostData.text).length
      : 0;
    const hasPost = Boolean(r.requestPostData?.text);

    const contentSize = r.responseBodyText
      ? r.responseEncoding === "base64"
        ? r.responseBodyText.length
        : new TextEncoder().encode(r.responseBodyText).length
      : 0;

    const content: {
      size: number;
      mimeType: string;
      text?: string;
      encoding?: string;
      comment?: string;
    } = {
      size: contentSize,
      mimeType: r.responseMimeType || "x-unknown",
    };
    if (r.responseBodyText !== undefined) {
      content.text = r.responseBodyText;
      if (r.responseEncoding) content.encoding = r.responseEncoding;
    }
    if (r.comment) content.comment = r.comment;

    return {
      pageref: pageId,
      startedDateTime: r.startedDateTime,
      time: Math.max(0, r.timeMs),
      request: {
        method: r.method,
        url: r.url,
        httpVersion: "HTTP/1.1",
        headers: reqHeaders,
        queryString: qs,
        cookies: [],
        headersSize: -1,
        bodySize: hasPost ? reqBodySize : -1,
        ...(r.requestPostData
          ? {
              postData: {
                mimeType: r.requestPostData.mimeType || "text/plain",
                text: r.requestPostData.text,
              },
            }
          : {}),
      },
      response: {
        status: r.responseStatus,
        statusText: r.responseStatusText || "",
        httpVersion: "HTTP/1.1",
        headers: resHeaders,
        cookies: [],
        content,
        redirectURL: "",
        headersSize: -1,
        bodySize: contentSize,
      },
      cache: {},
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: 0,
        wait: Math.max(0, Math.round(r.timeMs * 0.75)),
        receive: Math.max(0, Math.round(r.timeMs * 0.25)),
        ssl: -1,
      },
    };
  });

  return {
    log: {
      version: "1.2",
      creator: { name: "QA Feedback", version: EXTENSION_VERSION },
      pages,
      entries: harEntries,
    },
  };
}

export function harToJsonString(har: HarRoot): string {
  return JSON.stringify(har);
}
