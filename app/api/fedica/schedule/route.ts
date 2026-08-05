import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { postId, content, pipelineId, mediaUrls } = await req.json();

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

    // Note: Media upload to Fedica requires the full init/upload/finalize flow.
    // For MVP we schedule text-only and user can attach media later in Fedica UI,
    // or we can expand this later.
    const body = {
      PipelineId: Number(pipelineId) || 42303,
      Posts: [
        {
          Accounts: [
            {
              Platform: "Twitter",
              AccountId: "Seung4680",
            },
          ],
          Messages: [content],
          // MediaId will be added when full media pipeline is implemented
        },
      ],
    };

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

    // Update post status in Supabase
    const supabase = await createClient();
    await supabase
      .from("SeungContent")
      .update({
        status: "scheduled",
        fedica_post_id: String(data.Id),
      })
      .eq("id", postId);

    return NextResponse.json({
      success: true,
      fedicaId: data.Id,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
