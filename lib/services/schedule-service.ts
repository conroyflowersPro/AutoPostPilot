import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublisherProvider } from "@/lib/publishers/types";
import { prepareMediaForPublish } from "@/lib/services/media-service";
import { SCHEDULING_CONFIG } from "@/lib/config/scheduling";

export type ErrorStage =
  | "validate_post"
  | "validate_media"
  | "download_media"
  | "init_media"
  | "upload_media"
  | "finalize_media"
  | "publish_post"
  | "update_database"
  | "claim";

export type ScheduleOneResult =
  | {
      ok: true;
      id: string;
      status: "scheduled" | "already_scheduled";
      scheduledAt?: string;
      providerPostId?: string;
      mediaCount?: number;
      skipped?: boolean;
    }
  | {
      ok: false;
      id: string;
      status: "schedule_failed" | "skipped";
      errorStage: ErrorStage;
      errorInternal: string;
      errorUser: string;
      retryable?: boolean;
    };

function buildIdempotencyKey(
  postId: string,
  scheduledAtISO: string,
  provider: string
) {
  const t = scheduledAtISO.replace(/[^0-9T]/g, "").slice(0, 15);
  return `post_${postId}_${t}_${provider}`;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function scheduleOnePost(opts: {
  supabase: SupabaseClient;
  provider: PublisherProvider;
  post: {
    id: string;
    content: string;
    status: string;
    pipeline_id: string | null;
    media_urls: string[] | null;
    scheduled_at?: string | null;
    fedica_post_id?: string | null;
  };
  scheduledAtISO: string;
  pipelineId?: string;
  requireMedia?: boolean;
}): Promise<ScheduleOneResult> {
  const { supabase, provider, post, scheduledAtISO, requireMedia = true } = opts;
  const pipelineId =
    opts.pipelineId || post.pipeline_id || SCHEDULING_CONFIG.defaultPipelineId;

  if (post.status === "scheduled") {
    return {
      ok: true,
      id: post.id,
      status: "already_scheduled",
      scheduledAt: post.scheduled_at || undefined,
      providerPostId: post.fedica_post_id || undefined,
      skipped: true,
    };
  }

  if (post.status === "scheduling") {
    return {
      ok: false,
      id: post.id,
      status: "skipped",
      errorStage: "claim",
      errorInternal: "already scheduling",
      errorUser: "이미 예약 처리 중입니다.",
      retryable: false,
    };
  }

  if (post.status !== "reviewed" && post.status !== "schedule_failed") {
    return {
      ok: false,
      id: post.id,
      status: "skipped",
      errorStage: "validate_post",
      errorInternal: `invalid status ${post.status}`,
      errorUser: "reviewed 상태의 포스트만 예약할 수 있습니다.",
      retryable: false,
    };
  }

  if (!post.content?.trim()) {
    return {
      ok: false,
      id: post.id,
      status: "schedule_failed",
      errorStage: "validate_post",
      errorInternal: "empty content",
      errorUser: "본문이 비어 있습니다.",
      retryable: false,
    };
  }

  let claimed: any = null;
  let claimErr: any = null;
  {
    const full = await supabase
      .from("SeungContent")
      .update({
        status: "scheduling",
        last_attempt_at: new Date().toISOString(),
        schedule_provider: provider.name,
      })
      .eq("id", post.id)
      .in("status", ["reviewed", "schedule_failed"])
      .select("id, attempt_count")
      .maybeSingle();
    claimErr = full.error;
    claimed = full.data;
    if (claimErr && /column|schema/i.test(claimErr.message || "")) {
      const basic = await supabase
        .from("SeungContent")
        .update({ status: "scheduling" })
        .eq("id", post.id)
        .in("status", ["reviewed", "schedule_failed"])
        .select("id")
        .maybeSingle();
      claimErr = basic.error;
      claimed = basic.data;
    }
  }

  if (claimErr) {
    return {
      ok: false,
      id: post.id,
      status: "schedule_failed",
      errorStage: "claim",
      errorInternal: claimErr.message,
      errorUser: "예약 시작에 실패했습니다.",
      retryable: true,
    };
  }
  if (!claimed) {
    return {
      ok: false,
      id: post.id,
      status: "skipped",
      errorStage: "claim",
      errorInternal: "claim lost race or status changed",
      errorUser: "다른 요청에서 이미 처리 중이거나 상태가 변경되었습니다.",
      retryable: false,
    };
  }

  const attemptCount = Number((claimed as any).attempt_count || 0) + 1;
  try {
    await supabase
      .from("SeungContent")
      .update({ attempt_count: attemptCount })
      .eq("id", post.id);
  } catch {
    /* optional column */
  }

  const idempotencyKey = buildIdempotencyKey(
    post.id,
    scheduledAtISO,
    provider.name
  );

  try {
    const prepared = await prepareMediaForPublish(
      post.media_urls || [],
      provider,
      { requireMedia }
    );
    if (!prepared.ok) {
      await markFailed(supabase, post.id, {
        errorStage: prepared.errorStage as ErrorStage,
        errorInternal: prepared.errorInternal,
        errorUser: prepared.errorUser,
        attemptCount,
      });
      return {
        ok: false,
        id: post.id,
        status: "schedule_failed",
        errorStage: prepared.errorStage as ErrorStage,
        errorInternal: prepared.errorInternal,
        errorUser: prepared.errorUser,
        retryable: prepared.retryable,
      };
    }

    let lastPubErr = "";
    let providerPostId: string | undefined;
    let published = false;

    for (let attempt = 0; attempt <= SCHEDULING_CONFIG.publishRetries; attempt++) {
      const pub = await provider.schedulePost({
        content: post.content,
        scheduledAtISO,
        pipelineId,
        mediaIds: prepared.mediaIds,
        idempotencyKey,
      });
      if (pub.success) {
        published = true;
        providerPostId = pub.providerPostId;
        break;
      }
      lastPubErr = pub.error || "publish failed";
      if (!pub.retryable || attempt >= SCHEDULING_CONFIG.publishRetries) break;
      await sleep(SCHEDULING_CONFIG.retryDelayMs * (attempt + 1));
    }

    if (!published) {
      const userMsg = /timeout|abort|5\d\d|temporarily/i.test(lastPubErr)
        ? "일시적으로 예약에 실패했습니다. 잠시 후 다시 시도해 주세요."
        : "예약 등록에 실패했습니다.";
      await markFailed(supabase, post.id, {
        errorStage: "publish_post",
        errorInternal: lastPubErr,
        errorUser: userMsg,
        attemptCount,
      });
      return {
        ok: false,
        id: post.id,
        status: "schedule_failed",
        errorStage: "publish_post",
        errorInternal: lastPubErr,
        errorUser: userMsg,
        retryable: true,
      };
    }

    let updErr: any = null;
    {
      const full = await supabase
        .from("SeungContent")
        .update({
          status: "scheduled",
          scheduled_at: scheduledAtISO,
          fedica_post_id: providerPostId || null,
          last_error: null,
          error_stage: null,
          schedule_provider: provider.name,
          last_attempt_at: new Date().toISOString(),
          attempt_count: attemptCount,
        })
        .eq("id", post.id);
      updErr = full.error;
      if (updErr && /column|schema/i.test(updErr.message || "")) {
        const basic = await supabase
          .from("SeungContent")
          .update({
            status: "scheduled",
            scheduled_at: scheduledAtISO,
            fedica_post_id: providerPostId || null,
          })
          .eq("id", post.id);
        updErr = basic.error;
      }
    }

    if (updErr) {
      await supabase
        .from("SeungContent")
        .update({
          status: "scheduled",
          scheduled_at: scheduledAtISO,
          fedica_post_id: providerPostId || null,
        })
        .eq("id", post.id);
    }

    return {
      ok: true,
      id: post.id,
      status: "scheduled",
      scheduledAt: scheduledAtISO,
      providerPostId,
      mediaCount: prepared.mediaIds.length,
    };
  } catch (e: any) {
    const internal = e?.message || "schedule failed";
    await markFailed(supabase, post.id, {
      errorStage: "publish_post",
      errorInternal: internal,
      errorUser: "예약 처리 중 오류가 발생했습니다.",
      attemptCount,
    });
    return {
      ok: false,
      id: post.id,
      status: "schedule_failed",
      errorStage: "publish_post",
      errorInternal: internal,
      errorUser: "예약 처리 중 오류가 발생했습니다.",
      retryable: true,
    };
  }
}

async function markFailed(
  supabase: SupabaseClient,
  id: string,
  info: {
    errorStage: ErrorStage;
    errorInternal: string;
    errorUser: string;
    attemptCount: number;
  }
) {
  const full = await supabase
    .from("SeungContent")
    .update({
      status: "schedule_failed",
      last_error: info.errorInternal.slice(0, 500),
      error_stage: info.errorStage,
      last_attempt_at: new Date().toISOString(),
      attempt_count: info.attemptCount,
    })
    .eq("id", id);
  if (full.error && /column|schema/i.test(full.error.message || "")) {
    await supabase
      .from("SeungContent")
      .update({ status: "schedule_failed" })
      .eq("id", id);
  }
}
