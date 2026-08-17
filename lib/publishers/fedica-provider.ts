import { uploadMediaFromUrl } from "@/lib/fedica";
import type {
  PublisherProvider,
  SchedulePostInput,
  SchedulePostResult,
  MediaUploadResult,
} from "./types";
import { SCHEDULING_CONFIG } from "@/lib/config/scheduling";

export function formatFedicaDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid scheduledAtISO: ${iso}`);
  }
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Fedica Publishing Provider.
 * Keeps existing Fedica media + post API behavior; isolates endpoints from ScheduleService.
 *
 * Specific DateTime and PipelineId must not be sent together. PipelineId makes
 * Fedica ignore DateTime and fill the pipeline's next slot (often "now"), so
 * batch schedule stacks at the same minute.
 */
export class FedicaProvider implements PublisherProvider {
  readonly name = "fedica";

  async uploadMediaFromUrl(
    url: string,
    altText = "@Seung4680 content"
  ): Promise<MediaUploadResult> {
    const mediaId = await uploadMediaFromUrl(url, altText);
    return { mediaId };
  }

  async schedulePost(input: SchedulePostInput): Promise<SchedulePostResult> {
    const token = process.env.FEDICA_API_TOKEN;
    if (!token) {
      return {
        success: false,
        error: "FEDICA_API_TOKEN not configured",
        retryable: false,
      };
    }

    const accounts = input.accounts || [
      { Platform: "Twitter", AccountId: "Seung4680" },
    ];

    const postBody: Record<string, unknown> = {
      Accounts: accounts,
      Messages: [input.content],
    };
    if (input.mediaIds.length > 0) {
      postBody.MediaId = input.mediaIds;
    }

    const fedicaBody: Record<string, unknown> = {
      DateTime: formatFedicaDateTime(input.scheduledAtISO),
      Posts: [postBody],
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        SCHEDULING_CONFIG.providerTimeoutMs
      );
      let res: Response;
      try {
        res = await fetch("https://fedica.com/api/publish/post", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fedicaBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.Success) {
        const status = res.status;
        const retryable = status >= 500 || status === 429;
        return {
          success: false,
          error: data.Error || `Fedica post failed (${status})`,
          retryable,
          raw: data,
        };
      }

      return {
        success: true,
        providerPostId: data.Id != null ? String(data.Id) : undefined,
        raw: data,
      };
    } catch (e: any) {
      const msg =
        e?.name === "AbortError" ? "Fedica timeout" : e?.message || "Fedica error";
      return {
        success: false,
        error: msg,
        retryable: true,
      };
    }
  }
}

export function createDefaultPublisher(): PublisherProvider {
  return new FedicaProvider();
}
