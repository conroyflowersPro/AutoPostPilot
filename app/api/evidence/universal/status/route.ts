/**
 * GET /api/evidence/universal/status?job_id=
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const job_id = req.nextUrl.searchParams.get("job_id");
  if (!job_id) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("evidence_export_jobs")
    .select("*")
    .eq("job_id", job_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({
    job_id: data.job_id,
    dataset_id: data.dataset_id,
    phase: data.phase,
    status: data.status,
    source_mode: data.source_mode,
    checkpoint: data.checkpoint,
    progress: data.progress,
    error: data.error,
    updated_at: data.updated_at,
  });
}
