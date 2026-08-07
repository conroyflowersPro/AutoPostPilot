import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeKRBatchStartISO,
  computeStartISOForDate,
  buildDaySpreadSlots,
} from "@/lib/schedule";
import { createDefaultPublisher } from "@/lib/publishers/fedica-provider";
import { scheduleOnePost } from "@/lib/services/schedule-service";
import { SCHEDULING_CONFIG } from "@/lib/config/scheduling";

export const maxDuration = 26;

/** Thin API: UI sends chunks of SCHEDULING_CONFIG.batchSize */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pipelineId = String(
      body.pipelineId || SCHEDULING_CONFIG.defaultPipelineId
    );
    const requireMedia = body.requireMedia !== false;
    const postIds: string[] = Array.isArray(body.postIds)
      ? body.postIds.map(String).slice(0, SCHEDULING_CONFIG.batchSize)
      : [];
    const startDate =
      typeof body.startDate === "string" ? body.startDate.trim() : "";
    const maxPerDay = Math.min(8, Math.max(3, Number(body.maxPerDay) || 5));
    const slotOffset = Math.max(0, Number(body.slotOffset) || 0);
    const totalPlanned = Math.max(
      postIds.length,
      Number(body.totalPlanned) || postIds.length
    );

    if (!process.env.FEDICA_API_TOKEN) {
      return NextResponse.json(
        { error: "FEDICA_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    if (postIds.length === 0) {
      return NextResponse.json({
        success: true,
        scheduled: [],
        failed: [],
        skipped: [],
        message: "No post IDs",
        batchSize: SCHEDULING_CONFIG.batchSize,
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: posts, error } = await supabase
      .from("SeungContent")
      .select("*")
      .in("id", postIds);
    if (error) throw error;

    const byId = new Map((posts || []).map((p: any) => [p.id, p]));
    const ordered = postIds.map((id) => byId.get(id)).filter(Boolean) as any[];

    const startISO = startDate
      ? computeStartISOForDate(startDate)
      : computeKRBatchStartISO();

    const allSlots = buildDaySpreadSlots(
      startISO,
      Math.max(totalPlanned, slotOffset + ordered.length),
      maxPerDay
    );

    const provider = createDefaultPublisher();
    const scheduled: any[] = [];
    const failed: any[] = [];
    const skipped: any[] = [];

    for (let i = 0; i < ordered.length; i++) {
      const post = ordered[i];
      const scheduledAt =
        allSlots[slotOffset + i] || allSlots[allSlots.length - 1];
      const result = await scheduleOnePost({
        supabase,
        provider,
        post,
        scheduledAtISO: scheduledAt,
        pipelineId,
        requireMedia,
      });

      if (result.ok) {
        if (result.skipped || result.status === "already_scheduled") {
          skipped.push({
            id: result.id,
            reason: "already_scheduled",
            scheduledAt: result.scheduledAt,
            providerPostId: result.providerPostId,
          });
        } else {
          scheduled.push({
            id: result.id,
            fedicaId: result.providerPostId,
            scheduledAt: result.scheduledAt,
            mediaCount: result.mediaCount || 0,
          });
        }
      } else if (result.status === "skipped") {
        skipped.push({
          id: result.id,
          reason: result.errorUser,
          stage: result.errorStage,
        });
      } else {
        failed.push({
          id: result.id,
          error: result.errorUser,
          errorInternal: result.errorInternal,
          stage: result.errorStage,
          retryable: result.retryable,
        });
      }
    }

    return NextResponse.json({
      success: true,
      startISO,
      startDate: startDate || null,
      maxPerDay,
      batchSize: SCHEDULING_CONFIG.batchSize,
      slotOffset,
      scheduled,
      failed,
      skipped,
      total: ordered.length,
      message: `batch done: ok ${scheduled.length} / fail ${failed.length} / skip ${skipped.length}`,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
