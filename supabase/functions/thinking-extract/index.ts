/**
 * Creator Thinking Feature Extract — SAFE PILOT Edge
 *
 * Safety:
 * - Does NOT mutate Creator / Audience / Performance / Revenue DNA
 * - REPOST excluded by default; REPLY excluded from Publishing thinking
 * - Batch + time budget + pilot_max_posts
 * - Stores structure features only (not raw post copy as pattern)
 * - Rails written only as CANDIDATE via aggregate action
 *
 * Auth:
 * - Prefer logged-in user JWT
 * - Fallback: service role (Supabase Dashboard Test / Role postgres)
 *
 * Actions (JSON body.action):
 * - start | tick | status | aggregate
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const EXTRACTOR_VERSION = "thinking_feature_v1_pilot";
const DEFAULT_BATCH = 8;
const DEFAULT_BUDGET_MS = 14000;
const DEFAULT_PILOT_MAX = 40;
const MODEL = "grok-4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ActivityRow = {
  id: string;
  x_post_id: string;
  text_body: string | null;
  post_type: string | null;
  action_type: string | null;
  published_at: string | null;
  system_origin_class: string | null;
  origin: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function classifyPostType(row: ActivityRow): string {
  const pt = String(row.post_type || row.action_type || "").toUpperCase();
  if (pt.includes("REPLY")) return "REPLY";
  if (pt.includes("REPOST") || pt.includes("RETWEET")) return "REPOST";
  if (pt.includes("QUOTE")) return "QUOTE";
  if (pt.includes("ORIGINAL") || pt === "STATUS" || pt === "TWEET" || !pt) {
    const text = String(row.text_body || "");
    if (/^RT\s@/i.test(text)) return "REPOST";
    return "ORIGINAL";
  }
  const text = String(row.text_body || "");
  if (/^RT\s@/i.test(text)) return "REPOST";
  return "OTHER";
}

function isRecent14d(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= 14 * 24 * 60 * 60 * 1000;
}

function buildExtractPrompt(
  posts: Array<{ x_post_id: string; text: string; post_type: string }>
): string {
  return `You extract CREATOR THINKING STRUCTURE from posts.\nReturn JSON only: {"items":[{...}]}\n\nRules:\n- Extract STRUCTURE only, not polished rewrite of the post.\n- Do NOT invent facts that are not in the post.\n- Do NOT copy the full post text into any field.\n- reasoning_steps: short step labels only (e.g. "관찰","비교","의미","판단"), max 6.\n- trigger, first_interpretation, scale_shift, time_horizon, judgment_habit, ending_pattern: short phrases.\n- topic: coarse label (TESLA/FSD/CYBERTRUCK/ROBOTAXI/AI_TECH/LAFC/GAMING/DAILY/OTHER)\n- editorial_mode_guess: EXPERIENCE|OPINION|INFORMATIVE|COMPARE|CASUAL_OBSERVATION|OTHER\n- confidence: 0..1\n\nPosts:\n${JSON.stringify(posts)}`;
}

async function callXaiExtract(
  apiKey: string,
  posts: Array<{ x_post_id: string; text: string; post_type: string }>,
  signal: AbortSignal
): Promise<{ items: any[]; xai_used: boolean; error?: string }> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a structural analyst for Creator Thinking DNA. Output JSON only. No essay. No invented facts.",
        },
        { role: "user", content: buildExtractPrompt(posts) },
      ],
      temperature: 0.2,
      reasoning_effort: "low",
    }),
    signal,
  });
  const raw = await response.text();
  if (!response.ok) {
    return {
      items: [],
      xai_used: true,
      error: `xAI ${response.status}: ${raw.slice(0, 200)}`,
    };
  }
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return { items: [], xai_used: true, error: "xAI non-JSON" };
  }
  const content = String(data.choices?.[0]?.message?.content || "");
  try {
    const m = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : content);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return { items, xai_used: true };
  } catch {
    return { items: [], xai_used: true, error: "parse items failed" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const xaiKey = Deno.env.get("XAI_API_KEY");

    let supabase: SupabaseClient;
    let authMode: "user" | "service_role" = "user";

    // 1) Prefer real user JWT
    if (authHeader) {
      const userClient = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } });
      const {
        data: { user },
        error: userErr,
      } = await userClient.auth.getUser();
      if (!userErr && user) {
        supabase = userClient;
        authMode = "user";
      } else if (serviceRole) {
        // 2) Fallback: service role (Dashboard Test with Role postgres)
        supabase = createClient(supabaseUrl, serviceRole);
        authMode = "service_role";
      } else {
        return json({ error: "Not authenticated" }, 401);
      }
    } else if (serviceRole) {
      // Dashboard sometimes omits header when Role is selected
      supabase = createClient(supabaseUrl, serviceRole);
      authMode = "service_role";
    } else {
      return json({ error: "Missing Authorization" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");

    if (action === "status") {
      const jobId = body.job_id;
      if (!jobId) return json({ error: "job_id required" }, 400);
      const { data: job, error } = await supabase
        .from("thinking_extract_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (error) return json({ error: error.message }, 400);
      const { count } = await supabase
        .from("thinking_post_features")
        .select("id", { count: "exact", head: true })
        .eq("job_id", jobId);
      return json({
        success: true,
        job,
        feature_count: count ?? 0,
        auth_mode: authMode,
        safety: {
          mutates_creator_dna: false,
          pilot_default: true,
          extractor_version: EXTRACTOR_VERSION,
        },
      });
    }

    if (action === "start") {
      const mode = body.mode === "FULL" ? "FULL" : "PILOT";
      const pilot_max_posts =
        mode === "PILOT"
          ? Math.min(Number(body.pilot_max_posts) || DEFAULT_PILOT_MAX, 80)
          : Math.min(Number(body.pilot_max_posts) || 500, 3000);
      const batch_size = Math.min(
        Math.max(Number(body.batch_size) || DEFAULT_BATCH, 3),
        12
      );
      const budget_ms = Math.min(
        Math.max(Number(body.budget_ms) || DEFAULT_BUDGET_MS, 8000),
        18000
      );

      const row = {
        mode,
        status: "READY",
        pilot_max_posts,
        batch_size,
        budget_ms,
        include_original: body.include_original !== false,
        include_quote: body.include_quote !== false,
        include_reply: false,
        include_repost: false,
        processed_count: 0,
        skipped_count: 0,
        failed_batches: 0,
        xai_calls: 0,
        checkpoint_meta: {
          safety: "no_dna_mutation",
          extractor_version: EXTRACTOR_VERSION,
          auth_mode: authMode,
        },
      };
      const { data: job, error } = await supabase
        .from("thinking_extract_jobs")
        .insert(row)
        .select("*")
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({
        success: true,
        job,
        auth_mode: authMode,
        next: "POST action=tick with job_id",
        xAI_API_USED: false,
      });
    }

    if (action === "tick") {
      const jobId = body.job_id;
      if (!jobId) return json({ error: "job_id required" }, 400);
      if (!xaiKey) {
        return json(
          {
            error: "XAI_API_KEY not configured in Edge secrets",
            xAI_API_USED: false,
          },
          500
        );
      }

      const { data: job, error: jobErr } = await supabase
        .from("thinking_extract_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (jobErr || !job) return json({ error: jobErr?.message || "job not found" }, 400);

      if (job.status === "COMPLETE" || job.status === "CANCELLED") {
        return json({ success: true, job, done: true, xAI_API_USED: false, auth_mode: authMode });
      }
      if (job.processed_count >= job.pilot_max_posts) {
        await supabase
          .from("thinking_extract_jobs")
          .update({
            status: "COMPLETE",
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        return json({
          success: true,
          done: true,
          reason: "pilot_max_posts reached",
          xAI_API_USED: false,
          auth_mode: authMode,
        });
      }

      const t0 = Date.now();
      await supabase
        .from("thinking_extract_jobs")
        .update({
          status: "RUNNING",
          started_at: job.started_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      let q = supabase
        .from("account_activities")
        .select(
          "id, x_post_id, text_body, post_type, action_type, published_at, system_origin_class, origin"
        )
        .not("text_body", "is", null)
        .order("published_at", { ascending: false })
        .limit(40);

      if (job.cursor_published_at) {
        q = q.lt("published_at", job.cursor_published_at);
      }

      const { data: rows, error: actErr } = await q;
      if (actErr) {
        await supabase
          .from("thinking_extract_jobs")
          .update({
            status: "FAILED_RETRYABLE",
            last_error: actErr.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        return json({ error: actErr.message, xAI_API_USED: false }, 400);
      }

      const allowed: ActivityRow[] = [];
      for (const r of rows || []) {
        const kind = classifyPostType(r as ActivityRow);
        if (kind === "REPOST" && !job.include_repost) continue;
        if (kind === "REPLY" && !job.include_reply) continue;
        if (kind === "ORIGINAL" && !job.include_original) continue;
        if (kind === "QUOTE" && !job.include_quote) continue;
        if (kind !== "ORIGINAL" && kind !== "QUOTE") continue;
        const text = String((r as ActivityRow).text_body || "").trim();
        if (text.length < 12) continue;
        allowed.push(r as ActivityRow);
        if (allowed.length >= job.batch_size) break;
      }

      if (allowed.length === 0) {
        await supabase
          .from("thinking_extract_jobs")
          .update({
            status: "COMPLETE",
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", jobId);
        return json({
          success: true,
          done: true,
          reason: "no more eligible posts",
          xAI_API_USED: false,
          auth_mode: authMode,
        });
      }

      const remaining = job.pilot_max_posts - job.processed_count;
      const batch = allowed.slice(0, Math.min(job.batch_size, remaining));
      const payload = batch.map((r) => ({
        x_post_id: String(r.x_post_id),
        text: String(r.text_body || "").slice(0, 500),
        post_type: classifyPostType(r),
      }));

      const budgetLeft = Math.max(3000, job.budget_ms - (Date.now() - t0));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), budgetLeft);

      let extractResult: { items: any[]; xai_used: boolean; error?: string };
      try {
        extractResult = await callXaiExtract(xaiKey, payload, controller.signal);
      } catch (e: any) {
        extractResult = {
          items: [],
          xai_used: true,
          error: e?.name === "AbortError" ? "budget_abort" : String(e?.message || e),
        };
      } finally {
        clearTimeout(timer);
      }

      const byId = new Map(
        (extractResult.items || []).map((it: any) => [
          String(it.x_post_id || it.id || ""),
          it,
        ])
      );

      let written = 0;
      for (const r of batch) {
        const it = byId.get(String(r.x_post_id)) || {};
        const feature = {
          job_id: jobId,
          x_post_id: String(r.x_post_id),
          activity_id: r.id,
          post_type: classifyPostType(r),
          published_at: r.published_at,
          is_recent_14d: isRecent14d(r.published_at),
          topic: it.topic || null,
          editorial_mode_guess: it.editorial_mode_guess || null,
          trigger: it.trigger || null,
          first_interpretation: it.first_interpretation || null,
          reasoning_steps: Array.isArray(it.reasoning_steps)
            ? it.reasoning_steps.slice(0, 6)
            : [],
          scale_shift: it.scale_shift || null,
          time_horizon: it.time_horizon || null,
          judgment_habit: it.judgment_habit || null,
          ending_pattern: it.ending_pattern || null,
          source_pointer: `account_activities:${r.id}`,
          extractor_version: EXTRACTOR_VERSION,
          xai_used: !!extractResult.xai_used,
          confidence:
            typeof it.confidence === "number" ? it.confidence : null,
          raw_model_notes: extractResult.error
            ? String(extractResult.error).slice(0, 200)
            : null,
        };
        const { error: upErr } = await supabase
          .from("thinking_post_features")
          .upsert(feature, { onConflict: "job_id,x_post_id" });
        if (!upErr) written++;
      }

      const last = batch[batch.length - 1];
      const processed_count = job.processed_count + batch.length;
      const done =
        processed_count >= job.pilot_max_posts ||
        batch.length < job.batch_size;

      await supabase
        .from("thinking_extract_jobs")
        .update({
          status: done ? "COMPLETE" : "PAUSED",
          processed_count,
          xai_calls: (job.xai_calls || 0) + (extractResult.xai_used ? 1 : 0),
          cursor_published_at: last.published_at,
          cursor_x_post_id: last.x_post_id,
          failed_batches:
            (job.failed_batches || 0) + (extractResult.error ? 1 : 0),
          last_error: extractResult.error || null,
          finished_at: done ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
          checkpoint_meta: {
            last_batch_written: written,
            last_batch_size: batch.length,
            extractor_version: EXTRACTOR_VERSION,
            elapsed_ms: Date.now() - t0,
            auth_mode: authMode,
          },
        })
        .eq("id", jobId);

      return json({
        success: true,
        done,
        written,
        batch_size: batch.length,
        processed_count,
        pilot_max_posts: job.pilot_max_posts,
        extract_error: extractResult.error || null,
        xAI_API_USED: !!extractResult.xai_used,
        auth_mode: authMode,
        xai_usage: {
          thinking_feature_extract: !!extractResult.xai_used,
          seed_expansion: false,
          creator_generation: false,
        },
        next: done ? "action=aggregate (optional) or review features" : "action=tick again",
        safety: {
          mutates_creator_dna: false,
          rails_auto_promoted: false,
        },
      });
    }

    if (action === "aggregate") {
      const jobId = body.job_id;
      if (!jobId) return json({ error: "job_id required" }, 400);

      const { data: features, error } = await supabase
        .from("thinking_post_features")
        .select("*")
        .eq("job_id", jobId);
      if (error) return json({ error: error.message }, 400);

      const groups = new Map<string, any[]>();
      for (const f of features || []) {
        const steps = Array.isArray(f.reasoning_steps)
          ? f.reasoning_steps.map((s: any) => String(s)).join(">")
          : "";
        const key = [
          String(f.topic || "OTHER"),
          String(f.editorial_mode_guess || "OTHER"),
          steps || "UNKNOWN",
        ].join("|");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(f);
      }

      const candidates = [];
      for (const [rail_key, items] of groups) {
        if (items.length < 2) continue;
        const recent = items.filter((x) => x.is_recent_14d).length;
        const support = items.length;
        const confidence = Math.min(
          0.95,
          0.35 + support * 0.08 + recent * 0.05
        );
        if (confidence < 0.5) continue;
        const sample = items[0];
        const row = {
          job_id: jobId,
          rail_key: rail_key.slice(0, 200),
          topic: sample.topic,
          editorial_modes: [
            ...new Set(
              items.map((x) => x.editorial_mode_guess).filter(Boolean)
            ),
          ],
          trigger_summary: sample.trigger,
          expansion_steps: sample.reasoning_steps || [],
          support_count: support,
          recent_14d_support: recent,
          recent_usage: recent >= 2 ? "HIGH" : recent === 1 ? "MEDIUM" : "LOW",
          historical_strength: support >= 5 ? "HIGH" : support >= 3 ? "MEDIUM" : "LOW",
          confidence: Number(confidence.toFixed(2)),
          status: "CANDIDATE",
          evidence_post_ids: items.map((x) => x.x_post_id).slice(0, 20),
          notes: "SAFE PILOT aggregate — not promoted to Creator Thinking DNA",
        };
        const { data: ins } = await supabase
          .from("thinking_rail_candidates")
          .insert(row)
          .select("id, rail_key, support_count, confidence, status")
          .single();
        if (ins) candidates.push(ins);
      }

      return json({
        success: true,
        feature_count: (features || []).length,
        candidate_count: candidates.length,
        candidates,
        auth_mode: authMode,
        xAI_API_USED: false,
        safety: {
          mutates_creator_dna: false,
          status: "CANDIDATE_ONLY",
          promote_requires: "Master Creator approval",
        },
      });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json(
      {
        error: e?.message || "Internal error",
        xAI_API_USED: false,
      },
      500
    );
  }
});
