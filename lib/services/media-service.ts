import { SCHEDULING_CONFIG } from "@/lib/config/scheduling";
import type { PublisherProvider } from "@/lib/publishers/types";

export type MediaErrorStage =
  | "validate_media"
  | "download_media"
  | "init_media"
  | "upload_media"
  | "finalize_media";

export type MediaValidationResult = {
  ok: boolean;
  url: string;
  mimeType?: string;
  size?: number;
  kind?: "image" | "video" | "unknown";
  errorStage?: MediaErrorStage;
  errorInternal?: string;
  errorUser?: string;
  retryable?: boolean;
};

function userMessageFor(internal: string, stage: MediaErrorStage): string {
  const s = internal.toLowerCase();
  if (s.includes("413") || s.includes("too large") || s.includes("payload"))
    return "미디어 파일이 너무 커서 예약할 수 없습니다.";
  if (s.includes("heic") || s.includes("heif"))
    return "HEIC/HEIF 형식은 지원되지 않습니다. JPEG 또는 PNG로 변환해 주세요.";
  if (s.includes("unsupported") || s.includes("mime") || s.includes("format"))
    return "지원하지 않는 미디어 형식입니다.";
  if (s.includes("fetch") || s.includes("download") || stage === "download_media")
    return "미디어 파일을 불러오지 못했습니다. 다시 시도해 주세요.";
  if (s.includes("timeout") || s.includes("abort"))
    return "미디어 업로드 시간이 초과되었습니다.";
  return "미디어 처리 중 문제가 발생했습니다.";
}

export async function validateMediaUrl(url: string): Promise<MediaValidationResult> {
  if (!url || typeof url !== "string") {
    return {
      ok: false,
      url: String(url || ""),
      errorStage: "validate_media",
      errorInternal: "empty media url",
      errorUser: "미디어 주소가 없습니다.",
      retryable: false,
    };
  }
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return {
        ok: false,
        url,
        errorStage: "validate_media",
        errorInternal: `invalid protocol ${u.protocol}`,
        errorUser: "미디어 주소가 올바르지 않습니다.",
        retryable: false,
      };
    }
  } catch {
    return {
      ok: false,
      url,
      errorStage: "validate_media",
      errorInternal: "invalid url",
      errorUser: "미디어 주소가 올바르지 않습니다.",
      retryable: false,
    };
  }

  try {
    const head = await fetch(url, { method: "HEAD" }).catch(() => null);
    let mime =
      head?.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    let size = Number(head?.headers.get("content-length") || 0);

    if (!head || !head.ok || !mime) {
      const getRes = await fetch(url, { headers: { Range: "bytes=0-0" } }).catch(
        () => null
      );
      if (!getRes || (!getRes.ok && getRes.status !== 206)) {
        return {
          ok: false,
          url,
          errorStage: "download_media",
          errorInternal: `media not reachable (${getRes?.status || "fetch fail"})`,
          errorUser: "미디어 파일을 불러오지 못했습니다.",
          retryable: true,
        };
      }
      mime =
        getRes.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ||
        mime;
      const cr = getRes.headers.get("content-range");
      if (cr && /\/(\d+)$/.test(cr)) size = Number(RegExp.$1);
    }

    if (mime.includes("heic") || mime.includes("heif")) {
      return {
        ok: false,
        url,
        mimeType: mime,
        errorStage: "validate_media",
        errorInternal: `unsupported mime ${mime}`,
        errorUser: "HEIC/HEIF 형식은 지원되지 않습니다.",
        retryable: false,
      };
    }

    const isImage = mime.startsWith("image/");
    const isVideo = mime.startsWith("video/");
    if (isImage && size > 0 && size > SCHEDULING_CONFIG.maxImageBytes) {
      return {
        ok: false,
        url,
        mimeType: mime,
        size,
        kind: "image",
        errorStage: "validate_media",
        errorInternal: `image too large ${size}`,
        errorUser: "이미지 파일이 너무 커서 예약할 수 없습니다.",
        retryable: false,
      };
    }
    if (isVideo && size > 0 && size > SCHEDULING_CONFIG.maxVideoBytes) {
      return {
        ok: false,
        url,
        mimeType: mime,
        size,
        kind: "video",
        errorStage: "validate_media",
        errorInternal: `video too large ${size}`,
        errorUser: "영상 파일이 너무 커서 예약할 수 없습니다.",
        retryable: false,
      };
    }

    return {
      ok: true,
      url,
      mimeType: mime || undefined,
      size: size || undefined,
      kind: isImage ? "image" : isVideo ? "video" : "unknown",
    };
  } catch (e: any) {
    return {
      ok: false,
      url,
      errorStage: "validate_media",
      errorInternal: e?.message || "validate failed",
      errorUser: "미디어 검증에 실패했습니다.",
      retryable: true,
    };
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function prepareMediaForPublish(
  urls: string[],
  provider: PublisherProvider,
  opts?: { requireMedia?: boolean }
): Promise<
  | { ok: true; mediaIds: string[] }
  | {
      ok: false;
      errorStage: MediaErrorStage;
      errorInternal: string;
      errorUser: string;
      retryable: boolean;
    }
> {
  const requireMedia = opts?.requireMedia !== false;
  const list = (urls || []).filter(Boolean);
  if (list.length === 0) {
    if (requireMedia) {
      return {
        ok: false,
        errorStage: "validate_media",
        errorInternal: "no media urls",
        errorUser: "미디어가 있는 포스트만 예약할 수 있습니다.",
        retryable: false,
      };
    }
    return { ok: true, mediaIds: [] };
  }

  for (const url of list) {
    const v = await validateMediaUrl(url);
    if (!v.ok) {
      return {
        ok: false,
        errorStage: v.errorStage || "validate_media",
        errorInternal: v.errorInternal || "validation failed",
        errorUser: v.errorUser || "미디어 검증 실패",
        retryable: !!v.retryable,
      };
    }
  }

  const mediaIds: string[] = [];
  for (let i = 0; i < list.length; i++) {
    let lastErr = "";
    let uploaded = false;
    for (let attempt = 0; attempt <= SCHEDULING_CONFIG.mediaUploadRetries; attempt++) {
      try {
        const { mediaId } = await provider.uploadMediaFromUrl(
          list[i],
          `@Seung4680 media ${i + 1}`
        );
        mediaIds.push(mediaId);
        uploaded = true;
        break;
      } catch (e: any) {
        lastErr = e?.message || "upload failed";
        const permanent = /413|too large|unsupported|heic|invalid|401|403/i.test(
          lastErr
        );
        if (permanent || attempt >= SCHEDULING_CONFIG.mediaUploadRetries) break;
        await sleep(SCHEDULING_CONFIG.retryDelayMs * (attempt + 1));
      }
    }
    if (!uploaded) {
      return {
        ok: false,
        errorStage: "upload_media",
        errorInternal: lastErr,
        errorUser: userMessageFor(lastErr, "upload_media"),
        retryable: !/413|too large|unsupported|heic|invalid|401|403/i.test(lastErr),
      };
    }
  }
  return { ok: true, mediaIds };
}
