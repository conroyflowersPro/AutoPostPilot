import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDefaultPublisher } from "@/lib/publishers/fedica-provider";
import { scheduleOnePost } from "@/lib/services/schedule-service";
import { computeKRBatchStartISO } from "@/lib/schedule";
import { SCHEDULING_CONFIG } from "@/lib/config/scheduling";

export const maxDuration = 60;

/** Single-post schedule — same core as batch-schedule. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const postId = body.postId ? String(body.postId) : "";
    const pipelineId = String(
      body.pipelineId || SCHEDULING_CONFIG.defaultPipelineId
    );
    const requireMedia = body.requireMedia === true;
    const scheduledAt =
      typeof body.scheduledAt === "string" && body.scheduledAt.trim()
        ? body.scheduledAt.trim()
        : computeKRBatchStartISO();

    if (!postId) {
      return NextResponse.json({ error: "postId required" }, { status: 400 });
    }
    if (!process.env.FEDICA_API_TOKEN) {
      return NextResponse.json(
        { error: "FEDICA_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: post, error } = await supabase
      .from("SeungContent")
      .select(
        "id, content, status, pipeline_id, media_urls, scheduled_at, fedica_post_id, attempt_count"
      )
      .eq("id", postId)
      .maybeSingle();

    if (error) throw error;
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const provider = createDefaultPublisher();
    const result = await scheduleOnePost({
      supabase,
      provider,
      post,
      scheduledAtISO: scheduledAt,
      pipelineId,
      requireMedia,
    });

    if (result.ok) {
      return NextResponse.json({
        success: true,
        id: result.id,
        status: result.status,
        fedicaId: result.providerPostId,
        scheduledAt: result.scheduledAt,
        skipped: !!result.skipped,
        mediaCount: result.mediaCount || 0,
      });
    }

    const status =
      result.status === "skipped"
        ? 409
        : result.errorStage === "validate_post" ||
            result.errorStage === "validate_media"
          ? 400
          : 502;

    return NextResponse.json(
      {
        success: false,
        id: result.id,
        status: result.status,
        error: result.errorUser,
        errorInternal: result.errorInternal,
        stage: result.errorStage,
        retryable: result.retryable,
      },
      { status }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
