/**
 * Fedica Publishing API helpers
 * Base: https://fedica.com/api/publish
 */

const FEDICA_BASE = "https://fedica.com/api/publish";
const PT = "America/Los_Angeles";

/**
 * Operator pipeline + Specific Date: ISO-8601 with timezone offset (Pacific wall clock).
 * Personal @Seung4680 spacing is 11/15/19 PT, 3/day, 4-hour gap.
 */
export function formatFedicaDateTime(iso: string, timeZone = PT): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid scheduledAtISO: ${iso}`);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  const tzRaw = parts.find((p) => p.type === "timeZoneName")?.value || "GMT-07:00";
  const off = tzRaw.match(/([+-]\d{2}:\d{2})/);
  const offset = off ? off[1] : "-07:00";
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}${offset}`;
}

export function fedicaPostAccepted(
  httpOk: boolean,
  data: { Success?: unknown; success?: unknown; Id?: unknown; id?: unknown } | null
): boolean {
  if (!httpOk || !data) return false;
  if (data.Success === false || data.success === false) return false;
  return data.Success === true || data.success === true;
}

export function fedicaPipelineId(raw: string | number | undefined | null): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  return 42303;
}

function getToken() {
  const token = process.env.FEDICA_API_TOKEN || process.env.FEDICA_TOKEN || "";
  if (!token) throw new Error("FEDICA_API_TOKEN not configured");
  return token;
}

export async function fedicaFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${FEDICA_BASE}${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!res.ok || data?.Success === false) {
    const msg =
      data?.Error || data?.message || data?.error || text.slice(0, 200) || res.statusText;
    throw new Error(`Fedica ${path} failed (${res.status}): ${msg}`);
  }
  return data;
}

export async function listAccounts() {
  return fedicaFetch("/accounts");
}

export async function listPipelines() {
  return fedicaFetch("/pipelines");
}

/** Initialize media upload session → returns fileId (used as MediaId) */
export async function initMediaUpload(): Promise<string> {
  const data = await fedicaFetch("/media/init", { method: "POST" });
  if (!data.Id) throw new Error("No fileId returned from /media/init");
  return data.Id as string;
}

/** Upload a single chunk (base64). For simplicity we send the whole file as chunk 0. */
export async function uploadMediaChunk(
  fileId: string,
  base64Data: string,
  chunkIndex = 0
) {
  await fedicaFetch("/media/upload", {
    method: "POST",
    body: JSON.stringify({
      chunkIndex,
      fileId,
      file: base64Data,
    }),
  });
}

/** Finalize upload with metadata. fileId becomes the MediaId. */
export async function finalizeMediaUpload(
  fileId: string,
  metadata: {
    altText: string;
    mimeType: string;
    fileName: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number;
  }
) {
  await fedicaFetch("/media/finalize", {
    method: "POST",
    body: JSON.stringify({
      fileId,
      metadata,
    }),
  });
}

/**
 * Full flow: download from public URL → init → upload → finalize
 * Returns MediaId (fileId)
 */
export async function uploadMediaFromUrl(
  url: string,
  altText = "@Seung4680 content"
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch media: ${url}`);

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString("base64");
  const size = buffer.length;

  const urlPath = new URL(url).pathname;
  const fileName = urlPath.split("/").pop() || `media-${Date.now()}.jpg`;

  const fileId = await initMediaUpload();
  await uploadMediaChunk(fileId, base64, 0);
  await finalizeMediaUpload(fileId, {
    altText,
    mimeType: contentType,
    fileName,
    size,
  });

  return fileId;
}

/** Upload multiple media URLs and return array of MediaIds */
export async function uploadMultipleMedia(
  urls: string[],
  altTextPrefix = "@Seung4680"
): Promise<string[]> {
  const mediaIds: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const id = await uploadMediaFromUrl(urls[i], `${altTextPrefix} media ${i + 1}`);
    mediaIds.push(id);
  }
  return mediaIds;
}

export async function schedulePost(body: {
  PipelineId?: number | string;
  DateTime?: string;
  Posts: Array<{
    Accounts?: unknown[];
    Messages?: string[];
    MediaId?: string | number | string[];
  }>;
  Id?: string | number;
}) {
  return fedicaFetch("/post", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Schedule or publish posts via Fedica /post
 */
export async function scheduleFedicaPost(params: {
  pipelineId: string;
  message: string;
  mediaIds?: string[];
  dateTime?: string;
  accountId?: string;
}): Promise<{ id?: string; success: boolean; raw: any }> {
  const accountId = params.accountId || "Seung4680";
  const body: any = {
    PipelineId: fedicaPipelineId(params.pipelineId),
    Posts: [
      {
        Accounts: [{ Platform: "Twitter", AccountId: accountId }],
        Messages: [params.message],
        MediaId: params.mediaIds?.[0] || undefined,
      },
    ],
  };
  if (params.dateTime) {
    body.DateTime = formatFedicaDateTime(params.dateTime);
  }
  if (params.mediaIds && params.mediaIds.length > 1) {
    body.Posts[0].MediaIds = params.mediaIds;
  }

  const data = await fedicaFetch("/post", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { id: data.Id || data.id, success: true, raw: data };
}
