/**
 * POST /api/evidence/universal/tick
 * One timeout-safe batch. API_ONLY freezes package. Archive needs selective parts.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildEvidenceRecord } from "@/lib/export/build-evidence-record";
import { buildApiOnlyUniversalPackage } from "@/lib/universal-evidence/build-api-package";
import { BATCH_RUNTIME_BUDGET_MS } from "@/lib/universal-evidence/contract";

export const maxDuration = 26;

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

    const body = await req.json();
    const job_id = String(body.job_id || "");
    if (!job_id) {
      return NextResponse.json({ error: "job_id required" }, { status: 400 });
    }

    const { data: job, error: jobErr } = await supabase
      .from("evidence_export_jobs")
      .select("*")
      .eq("job_id", job_id)
      .maybeSingle();

    if (jobErr) {
      return NextResponse.json({ error: jobErr.message }, { status: 500 });
    }
    if (!job) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }

    if (job.phase === "COMPLETE" || job.phase === "FROZEN") {
      return NextResponse.json({
        job_id,
        phase: job.phase,
        already_done: true,
        dataset_id: job.dataset_id,
        elapsed_ms: Date.now() - t0,
      });
    }

    if (job.source_mode === "API_ONLY") {
      await supabase
        .from("evidence_export_jobs")
        .update({
          phase: "PARSING",
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", job_id);

      const accountId = job.account_id as string;
      const posts: ReturnType<typeof buildEvidenceRecord>[] = [];
      let off = 0;
      const page = 500;
      let latest: string | null = null;

      while (Date.now() - t0 < BATCH_RUNTIME_BUDGET_MS) {
        const { data, error } = await supabase
          .from("account_activities")
          .select(
            "x_post_id, published_at, origin, action_type, post_type, text_body, source_post_url, conversation_id, in_reply_to_user_id, x_author_id, collection_source, meta"
          )
          .eq("account_id", accountId)
          .order("published_at", { ascending: true, nullsFirst: false })
          .range(off, off + page - 1);
        if (error) throw new Error(error.message);
        if (!data?.length) break;
        for (const row of data) {
          const rec = buildEvidenceRecord(row as Record<string, unknown>);
          posts.push(rec);
          if (rec.published_at) {
            if (!latest || rec.published_at > latest) latest = rec.published_at;
          }
        }
        off += data.length;
        if (data.length < page) break;
      }

      await supabase
        .from("evidence_export_jobs")
        .update({
          phase: "PACKAGING",
          checkpoint: {
            records_processed: posts.length,
            completed_files: ["account_activities"],
            current_offset: off,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", job_id);

      const pkg = buildApiOnlyUniversalPackage({
        posts: posts.map((p) => ({
          x_post_id: p.x_post_id,
          published_at: p.published_at,
          post_type: p.post_type,
          origin: p.origin,
          text: p.text,
          public_metrics: p.public_metrics,
          organic_metrics: p.organic_metrics,
          non_public_metrics: p.non_public_metrics,
          metric_availability: p.metric_availability,
          snapshot_count: p.snapshot_count,
          media: p.media,
          conversation_id: p.conversation_id,
          in_reply_to_user_id: p.in_reply_to_user_id,
        })),
        apiCutoff: latest,
      });

      pkg.manifest.dataset_id = job.dataset_id || pkg.dataset_id;
      pkg.files["00_manifest.json"] = JSON.stringify(pkg.manifest, null, 2);

      await supabase
        .from("evidence_datasets")
        .update({
          status: "FROZEN",
          frozen_at: pkg.frozen_at,
          api_cutoff: latest,
          manifest: pkg.manifest,
          package_meta: {
            file_names: Object.keys(pkg.files),
            populations: pkg.manifest.populations,
          },
        })
        .eq("dataset_id", job.dataset_id);

      await supabase
        .from("evidence_export_jobs")
        .update({
          phase: "COMPLETE",
          status: "ok",
          progress: {
            records_processed: posts.length,
            dataset_id: job.dataset_id,
            frozen_at: pkg.frozen_at,
            populations: pkg.manifest.populations,
            files: pkg.manifest.files,
          },
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", job_id);

      return NextResponse.json({
        job_id,
        phase: "COMPLETE",
        dataset_id: job.dataset_id,
        frozen_at: pkg.frozen_at,
        populations: pkg.manifest.populations,
        files: pkg.manifest.files,
        package_files: pkg.files,
        elapsed_ms: Date.now() - t0,
        budget_ms: BATCH_RUNTIME_BUDGET_MS,
        learning_mutation: "NONE",
      });
    }

    await supabase
      .from("evidence_export_jobs")
      .update({
        phase: "QUEUED",
        error:
          "Archive parts not attached. Use selective archive slices — never full 25GB in one function.",
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", job_id);

    return NextResponse.json({
      job_id,
      phase: "QUEUED",
      message:
        "API_AND_ARCHIVE / ARCHIVE_ONLY requires selective archive part upload",
      elapsed_ms: Date.now() - t0,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
