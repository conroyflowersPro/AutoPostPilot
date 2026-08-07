import { uploadMediaFromUrl } from "@/lib/fedica";
import type {
  PublisherProvider,
  SchedulePostInput,
  SchedulePostResult,
  MediaUploadResult,
} from "./types";
import { SCHEDULING_CONFIG } from "@/lib/config/scheduling";

/**
 * Fedica Publishing Provider.
 * Keeps existing Fedica media + post API behavior; isolates endpoints from ScheduleService.
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

    const fedicaBody = {
      PipelineId: Number(input.pipelineId) || 42303,
      DateTime: input.scheduledAtISO,
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
