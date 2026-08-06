import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadMultipleMedia } from "@/lib/fedica";

export async function POST(req: NextRequest) {
  try {
    const { postId, content, pipelineId, mediaUrls, scheduledAt } =
      await req.json();

    if (!postId || !content) {
      return NextResponse.json(
        { error: "postId and content required" },
        { status: 400 }
      );
    }

    const token = process.env.FEDICA_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "FEDICA_API_TOKEN not configured" },
        { status: 500 }
      );
    }

    const supabase = await createClient();

    // Enforce reviewed-only
    const { data: existing } = await supabase
      .from("SeungContent")
      .select("status")
      .eq("id", postId)
      .single();

    if (!existing || existing.status !== "reviewed") {
      return NextResponse.json(
        {
          error:
            "검수(reviewed) 완료된 포스트만 Fedica 스케줄링할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    let mediaIds: string[] = [];
    if (mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      try {
        mediaIds = await uploadMultipleMedia(mediaUrls);
      } catch (mediaErr: any) {
        console.error("Fedica media upload failed:", mediaErr);
        return NextResponse.json(
          {
            error: `미디어 업로드 실패: ${mediaErr.message}`,
          },
          { status: 502 }
        );
      }
    }

    const postBody: any = {
      Accounts: [
        {
          Platform: "Twitter",
          AccountId: "Seung4680",
        },
      ],
      Messages: [content],
    };

    if (mediaIds.length > 0) {
      postBody.MediaId = mediaIds;
    }

    const body: any = {
      PipelineId: Number(pipelineId) || 42303,
      Posts: [postBody],
    };

    if (scheduledAt) {
      body.DateTime = scheduledAt;
    }

    const res = await fetch("https://fedica.com/api/publish/post", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || !data.Success) {
      return NextResponse.json(
        { error: data.Error || "Fedica API failed" },
        { status: 502 }
      );
    }

    const updatePayload: any = {
      status: "scheduled",
      fedica_post_id: String(data.Id),
    };
    if (scheduledAt) {
      updatePayload.scheduled_at = scheduledAt;
    }

    await supabase.from("SeungContent").update(updatePayload).eq("id", postId);

    return NextResponse.json({
      success: true,
      fedicaId: data.Id,
      mediaIds,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
