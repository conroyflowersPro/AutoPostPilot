import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runPhase1ABatch } from "@/lib/x/batch-collect";

export const maxDuration = 26;

/** One short batch per request. UI auto-continues while shouldContinue. */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const result = await runPhase1ABatch({
      maxPagesPerBatch:
        typeof body.maxPagesPerBatch === "number"
          ? body.maxPagesPerBatch
          : typeof body.maxPages === "number"
            ? body.maxPages
            : 2,
      includeMentions: body.includeMentions !== false,
    });

    return NextResponse.json({
      success: result.ok,
      phase: "PHASE_1A_BATCH",
      phaseStatus: "STOP_FOR_REVIEW_WHEN_COMPLETE",
      learned: false,
      version: "5.5.8",
      ...result,
    });
  } catch (e: any) {
    console.error("phase1a batch", e);
    return NextResponse.json(
      {
        success: false,
        error: String(e?.message || e),
        shouldContinue: true,
        status: "FAILED_RETRYABLE",
        learned: false,
        version: "5.5.8",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { getPhase1ACollectStatus } = await import("@/lib/x/batch-collect");
    const status = await getPhase1ACollectStatus();
    return NextResponse.json({
      phase: "PHASE_1A_BATCH",
      version: "5.5.8",
      ...status,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
