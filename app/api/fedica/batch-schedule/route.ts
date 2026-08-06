import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadMultipleMedia } from "@/lib/fedica";
import {
  computeKRBatchStartISO,
  assignSlotsWithGrok,
} from "@/lib/schedule";

/**
 * Batch schedule all reviewed Korean posts that have media.
 * One click from the client.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pipelineId = String(body.pipelineId || "42303");
    const requireMedia = body.requireMedia !== false; // default true

    const token = process.env.FEDICA_API_TOKEN;
    const xaiKey = process.env.XAI_API_KEY;
    if (!token) {
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

    // Only reviewed, not yet scheduled, KR pipeline
    const { data: posts, error } = await supabase
      .from("SeungContent")
      .select("*")
      .eq("status", "reviewed")
      .eq("pipeline_id", pipelineId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    let eligible = posts || [];
    if (requireMedia) {
      eligible = eligible.filter(
        (p) => p.media_urls && p.media_urls.length > 0
      );
    }

    if (eligible.length === 0) {
      return NextResponse.json({
        success: true,
        scheduled: [],
        skipped: [],
        message:
          "스케줄할 reviewed 포스트가 없습니다. (검수 완료 + 미디어 필요)",
      });
    }

    const startISO = computeKRBatchStartISO();
    const slots = xaiKey
      ? await assignSlotsWithGrok(
          eligible.map((p) => ({ id: p.id, content: p.content })),
          startISO,
          xaiKey
        )
      : eligible.map((_: any, i: number) =>
          new Date(
            new Date(startISO).getTime() + i * 3 * 60 * 60 * 1000
          ).toISOString()
        );

    const results: any[] = [];
    const failures: any[] = [];

    for (let i = 0; i < eligible.length; i++) {
      const post = eligible[i];
      const scheduledAt = slots[i];

      try {
        let mediaIds: string[] = [];
        if (post.media_urls && post.media_urls.length > 0) {
          mediaIds = await uploadMultipleMedia(post.media_urls);
        }

        const postBody: any = {
          Accounts: [
            { Platform: "Twitter", AccountId: "Seung4680" },
          ],
          Messages: [post.content],
        };
        if (mediaIds.length > 0) postBody.MediaId = mediaIds;

        const fedicaBody = {
          PipelineId: Number(pipelineId) || 42303,
          DateTime: scheduledAt,
          Posts: [postBody],
        };

        const res = await fetch("https://fedica.com/api/publish/post", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fedicaBody),
        });

        const data = await res.json();
        if (!res.ok || !data.Success) {
          throw new Error(data.Error || "Fedica API failed");
        }

        await supabase
          .from("SeungContent")
          .update({
            status: "scheduled",
            fedica_post_id: String(data.Id),
            scheduled_at: scheduledAt,
          })
          .eq("id", post.id);

        results.push({
          id: post.id,
          fedicaId: data.Id,
          scheduledAt,
          mediaCount: mediaIds.length,
        });
      } catch (err: any) {
        failures.push({
          id: post.id,
          error: err.message || "failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      startISO,
      scheduled: results,
      failed: failures,
      total: eligible.length,
      message: `${results.length}/${eligible.length}개 스케줄 완료`,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
