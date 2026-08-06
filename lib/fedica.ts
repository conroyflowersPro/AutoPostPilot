/**
 * Fedica Publishing API helpers
 * Base: https://fedica.com/api/publish
 */

const FEDICA_BASE = "https://fedica.com/api/publish";

function getToken() {
  const token = process.env.FEDICA_API_TOKEN;
  if (!token) throw new Error("FEDICA_API_TOKEN not configured");
  return token;
}

async function fedicaFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${FEDICA_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.Success === false) {
    throw new Error(data.Error || `Fedica ${path} failed (${res.status})`);
  }
  return data;
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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

  // Derive filename
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

/**
 * Upload multiple media URLs and return array of MediaIds
 */
export async function uploadMultipleMedia(
  urls: string[],
  altTextPrefix = "@Seung4680"
): Promise<string[]> {
  const mediaIds: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const id = await uploadMediaFromUrl(
      urls[i],
      `${altTextPrefix} media ${i + 1}`
    );
    mediaIds.push(id);
  }
  return mediaIds;
}
