import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runPhase1AMaxCollection } from "@/lib/x/collect";
import { getXConnectionMeta } from "@/lib/x/client";

export const maxDuration = 60;

/**
 * Phase 1A — Maximum X API collection
 * POST: run collection (auth required)
 * GET: connection status only (no collection)
 * Does NOT run DNA learning.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const meta = await getXConnectionMeta();
    return NextResponse.json({
      phase: "PHASE_1A_X_API_MAX_COLLECTION",
      connection: meta,
      usage:
        'POST /api/x/collect  body optional: { includeMentions?: boolean, maxPages?: number }',
      note: "Does not learn DNA. Collect only.",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

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
    const result = await runPhase1AMaxCollection({
      includeMentions: body.includeMentions !== false,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
    });

    return NextResponse.json({
      success: result.ok,
      error: result.error || null,
      phase: "PHASE_1A_X_API_MAX_COLLECTION",
      phaseStatus: "STOP_FOR_REVIEW",
      learned: false,
      itemsCreated: result.itemsCreated,
      itemsUpdated: result.itemsUpdated,
      mentionsCreated: result.mentionsCreated,
      report: result.report,
      messageKo:
        "X API 최대 수집 시도 완료. DNA Learning은 실행하지 않았습니다. Coverage Report를 검토하세요.",
    });
  } catch (e: any) {
    console.error("phase1a collect", e);
    return NextResponse.json(
      {
        error: String(e?.message || e),
        phaseStatus: "STOP_FOR_REVIEW",
        learned: false,
      },
      { status: 500 }
    );
  }
}
