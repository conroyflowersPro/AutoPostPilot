import { uploadMediaFromUrl, fedicaFetch, formatFedicaDateTime, fedicaPostAccepted, fedicaPipelineId } from "@/lib/fedica";
import type {
  PublisherProvider,
  SchedulePostInput,
  SchedulePostResult,
  MediaUploadResult,
  PublishAccount,
} from "./types";
import { SCHEDULING_CONFIG } from "@/lib/config/scheduling";

export { formatFedicaDateTime, fedicaPostAccepted };

async function resolveTwitterAccounts(
  fallback: PublishAccount[]
): Promise<PublishAccount[]> {
  try {
    const data = await fedicaFetch("/accounts");
    const rows = Array.isArray(data?.Accounts) ? data.Accounts : [];
    const matched = rows
      .map((row: { Platform?: string; AccountId?: string }) => ({
        Platform: String(row?.Platform || "").trim(),
        AccountId: String(row?.AccountId || "").trim(),
      }))
      .filter(
        (row: PublishAccount) =>
          row.AccountId && /^(twitter|x)$/i.test(row.Platform)
      );
    if (matched.length > 0) return matched;
  } catch {
    /* use fallback */
  }
  return fallback;
}

/**
 * Fedica Publishing Provider.
 * Operator pipeline + Specific DateTime. Slot times use X For You ~2h author-diversity gaps.
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

    const fallbackAccounts = input.accounts || [
      { Platform: "Twitter", AccountId: "Seung4680" },
    ];
    const accounts = await resolveTwitterAccounts(fallbackAccounts);

    const postBody: Record<string, unknown> = {
      Accounts: accounts,
      Messages: [input.content],
    };
    if (input.mediaIds.length > 0) {
      postBody.MediaId = input.mediaIds.map(String);
    }

    const dateTime = formatFedicaDateTime(input.scheduledAtISO);
    const pipelineId = fedicaPipelineId(input.pipelineId);
    const fedicaBody: Record<string, unknown> = {
      PipelineId: pipelineId,
      DateTime: dateTime,
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
      if (!fedicaPostAccepted(res.ok, data)) {
        const status = res.status;
        const retryable = status >= 500 || status === 429;
        return {
          success: false,
          error: data.Error || data.error || `Fedica post failed (${status})`,
          retryable,
          raw: { ...data, sentDateTime: dateTime, sentPipelineId: pipelineId },
        };
      }

      return {
        success: true,
        providerPostId: data.Id != null ? String(data.Id) : data.id != null ? String(data.id) : undefined,
        raw: { ...data, sentDateTime: dateTime, sentPipelineId: pipelineId },
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
