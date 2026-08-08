/**
 * POST /api/evidence/universal/start
 * Returns 202 + job_id immediately. Does not parse 25GB inline.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { makeDatasetId } from "@/lib/universal-evidence/contract";
import { randomUUID } from "crypto";

export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sourceMode = String(body.source_mode || "API_ONLY").toUpperCase();
    const mode =
      sourceMode === "API_AND_ARCHIVE" || sourceMode === "ARCHIVE_ONLY"
        ? sourceMode
        : "API_ONLY";

    const { data: conn } = await supabase
      .from("account_connections")
      .select("id, handle")
      .eq("user_id", user.id)
      .eq("platform", "x")
      .maybeSingle();

    if (!conn?.id) {
      return NextResponse.json(
        { error: "No X account_connection" },
        { status: 404 }
      );
    }

    const job_id = `job_${randomUUID()}`;
    const dataset_id = makeDatasetId();

    const { error } = await supabase.from("evidence_export_jobs").insert({
      job_id,
      dataset_id,
      account_id: conn.id,
      phase: "QUEUED",
      status: "running",
      source_mode: mode,
      checkpoint: {
        current_source_file: null,
        current_offset: 0,
        records_processed: 0,
        completed_files: [],
        output_chunks: [],
        errors: [],
      },
      progress: { handle: conn.handle, started_hint: true },
    });

    if (error) {
      return NextResponse.json(
        {
          accepted: true,
          job_id,
          dataset_id,
          phase: "QUEUED",
          source_mode: mode,
          message:
            "Job id issued; persist failed — apply migration evidence_export_jobs",
          persist_error: error.message,
          response_ms: Date.now() - t0,
        },
        { status: 202 }
      );
    }

    await supabase.from("evidence_datasets").insert({
      dataset_id,
      export_version: "universal-evidence-v1",
      schema_version: "evidence-schema-v1",
      status: "BUILDING",
      source_mode: mode,
      account_id: conn.id,
    });

    return NextResponse.json(
      {
        accepted: true,
        job_id,
        dataset_id,
        phase: "QUEUED",
        source_mode: mode,
        next: "POST /api/evidence/universal/tick with job_id",
        response_ms: Date.now() - t0,
      },
      { status: 202 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
        response_ms: Date.now() - t0,
      },
      { status: 500 }
    );
  }
}
