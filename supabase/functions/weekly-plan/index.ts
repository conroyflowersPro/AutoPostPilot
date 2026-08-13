/**
 * Weekly Planner Edge — ORDER 8D functional restore
 * Full ORDER8C compactSlot path pending; expand uses real seed-engine.
 * CORS: Access-Control-Allow-Methods included.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  applyLocalGates,
  createSeedIdFactory,
  bootstrapCandidatesFromDimensions,
  isSelectableStatus,
  canServeEditorialMode,
  evaluateEditorialSeedQuality,
  ideaAngleKey,
  conceptualDiversityScore,
  conceptualRepetitionLevel,
  type ConcreteSeed,
} from "./seed-engine.ts";
import {
  allocateEditorialSlots,
  buildEditorialQueue,
  lengthForEditorial,
  type EditorialMode,
} from "./editorial-mix.ts";
import { judgeSeedGrounding, countIntegrityOk } from "./runtime-grounding.ts";
import {
  guardCandidateAgainstManualLeakage,
  type RecentManualPost,
} from "./manual-leakage-guard.ts";
import { isSeedEligibleRole, type SourceRole } from "./source-roles.ts";
import {
  parseEditorialMode,
  WEEKLY_EDITORIAL_MODES,
  buildModeSupplyReport,
} from "./seed-engine.ts";
import {
  redistributeDailyTopics,
  topicDistributionReport,
  softDailyCap,
} from "./daily-topic-distribute.ts";

const POSTS_MIN = 5;
const POSTS_MAX = 8;
const POSTS_TARGET = 6;
const APP_VERSION = "10.0.0";
const WEEKLY_ENGINE_VERSION = "phased_v10_order8d_functional_restore";
const GENERATOR_VERSION = "creator_dna_publishing_v1.3.2_vocab_fidelity";
const GIT_COMMIT = Deno.env.get("GIT_COMMIT") || Deno.env.get("COMMIT_SHA") || "main";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function majorKey(cluster: string, subject: string): string {
  const c = (cluster || "").toUpperCase();
  const s = (subject || "").toLowerCase();
  if (c.includes("CYBER") || /cybertruck|사이버/.test(s)) return "CYBERTRUCK";
  if (c === "FSD" || /\bfsd\b/.test(s)) return "FSD";
  if (/robotaxi|로보택시|curb|주정차|승하차/.test(s) || c === "ROBOTAXI") return "ROBOTAXI";
  if (/lafc|bmo|직관/.test(s) || c === "LAFC") return "LAFC";
  if (c === "AI_TECH" || /\bai\b|grok|그록/.test(s)) return "AI_TECH";
  if (c === "GAMING" || /게임/.test(s)) return "GAMING";
  return c || "OTHER";
}

function seedArrayFromBody(body: any): any[] {
  if (Array.isArray(body?.seeds) && body.seeds.length) return body.seeds;
  if (Array.isArray(body?.candidates) && body.candidates.length) return body.candidates;
  if (Array.isArray(body?.gated_seeds) && body.gated_seeds.length) return body.gated_seeds;
  return [];
}

function compactSlotLite(seed: ConcreteSeed, dayOffset: number, slot: number, mode: EditorialMode) {
  return {
    slotId: `D${dayOffset + 1}P${slot}`,
    dayOffset,
    primaryTopic: seed.concrete_subject,
    topic_cluster: seed.cluster,
    cluster: seed.cluster,
    concrete_subject: seed.concrete_subject,
    editorial_mode: mode,
    length_mode: lengthForEditorial(mode),
    angle: seed.point_or_tension || "",
    actionType: "ORIGINAL",
    planning_source: "PHASED_SEED",
    idea_angle_key: ideaAngleKey(seed),
    seed_id: seed.seed_id,
    creator_evidence_available: !!seed.creator_evidence_available,
    primary_source: seed.primary_source,
    source_type: seed.source_type || seed.primary_source,
    evidence_source_ids: seed.evidence_source_ids || [],
    claim_types: seed.claim_types || [],
    inference_type: seed.inference_type || "UNKNOWN",
    grounding_status: seed.grounding_status || "UNKNOWN",
    grounding_reasons: seed.grounding_reasons || [],
    final_text: "",
    generation_status: "PENDING_GENERATION",
    order8d_functional_restore: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing Authorization", days: [] }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Not authenticated", days: [] }, 401);

    const body = await req.json().catch(() => ({}));
    const phase = String(body.phase || "").toLowerCase() || "expand";
    const postsPerDay = Math.min(POSTS_MAX, Math.max(POSTS_MIN, Number(body.postsPerDay) || POSTS_TARGET));
    const daysCount = Math.min(Math.max(Number(body.generationDays) || 7, 1), 7);
    const required_slots = postsPerDay * daysCount;
    const xaiKey = (Deno.env.get("XAI_API_KEY") || "").trim();
    const t0 = Date.now();

    if (phase === "expand") {
      const published = Array.isArray(body.publishedTopics)
        ? body.publishedTopics.map(String)
        : Array.isArray(body.publishedTopics21d)
          ? body.publishedTopics21d.map(String)
          : [];
      const intentText = String(body.creatorIntent || body.topic || "").trim();
      const since = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString();
      const { data: actRows } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, origin, system_origin_class, x_post_id")
        .gte("published_at", since)
        .limit(400);
      const evidenceSubjects: string[] = [];
      const publishedEvidence: Array<{ text: string; source_id?: string; published_at?: string; post_type?: string }> = [];
      for (const row of actRows || []) {
        const t = String((row as any).text_body || "").trim();
        if (t.length < 12) continue;
        const pt = String((row as any).post_type || (row as any).action_type || "").toUpperCase();
        if (pt.includes("REPLY") || pt.includes("REPOST") || pt.includes("RETWEET")) continue;
        const soc = String((row as any).system_origin_class || "").toUpperCase();
        if (soc && /APP|SYSTEM|AUTOPOST|GENERATED/.test(soc)) continue;
        evidenceSubjects.push(t.slice(0, 160));
        publishedEvidence.push({
          text: t,
          source_id: (row as any).x_post_id || undefined,
          published_at: (row as any).published_at || undefined,
          post_type: pt,
        });
      }
      const local = bootstrapCandidatesFromDimensions({
        publishedSubjects: published,
        publishedEvidence,
        intentText,
      });
      const nextId = createSeedIdFactory("s");
      const gated = applyLocalGates(local, [], nextId);
      const recentManual: RecentManualPost[] = publishedEvidence.map((p) => ({
        text: p.text,
        source_id: p.source_id,
        published_at: p.published_at,
        post_type: p.post_type,
      }));
      let leakage_blocked = 0;
      const candidates: any[] = [];
      for (const c of gated.passed) {
        const role = (c.source_role as SourceRole) || "SEED_SOURCE";
        const g = guardCandidateAgainstManualLeakage({
          source_role: role,
          concrete_subject: String(c.concrete_subject || ""),
          point_or_tension: c.point_or_tension ? String(c.point_or_tension) : undefined,
          recent_manual: recentManual,
          user_explicit: role === "USER_EXPLICIT_SEED",
        });
        if (!g.allow_as_seed) {
          leakage_blocked += 1;
          continue;
        }
        candidates.push({
          ...c,
          source_role: role,
          source_trace: {
            source_role: role,
            source_type: (c.source_type as string) || "DIMENSION_REGISTRY",
            manual_source_used: false,
            manual_text_exposed_to_generation: false,
            leakage_guard_result: g.reason === "PASS" ? "PASS" : "BLOCK_SEMANTIC",
            semantic_recent_post_overlap: g.semantic_recent_post_overlap,
          },
        });
      }
      const supply_low = candidates.length < Math.min(required_slots, 8);
      return json({
        success: true,
        phase: "expand",
        candidates,
        gated_seeds: candidates,
        expand_done: true,
        dim_batch_index: 0,
        dim_batch_total: 1,
        next_dim_batch_index: 1,
        id_counter: candidates.length,
        engine: WEEKLY_ENGINE_VERSION,
        xai_api_used: false,
        seed_count: candidates.length,
        key_present: !!xaiKey,
        key_len: xaiKey.length,
        expand_model: "none_evidence_only",
        supply_low,
        diagnostics: {
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          local_raw: local.length,
          local_passed: gated.passed.length,
          local_rejected: gated.local_gate_rejected,
          expand_model: "none_evidence_only",
          evidence_activity_rows: (actRows || []).length,
          evidence_subjects: evidenceSubjects.length,
          published_evidence_rows: publishedEvidence.length,
          published_input: published.length,
          order0b_manual_leakage_separation: true,
          order0b_leakage_blocked: leakage_blocked,
          order8d_functional_restore: true,
          order8d_cors_methods: true,
          language_policy: "Korean output; location only from Evidence",
          supply_low,
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
        },
        timing: { total_ms: Date.now() - t0 },
      });
    }

    if (phase === "judge") {
      const batch = seedArrayFromBody(body);
      const judged: ConcreteSeed[] = [];
      let grounding_reject = 0;
      for (const b of batch) {
        const mode = parseEditorialMode(b.requested_editorial_mode || b.editorial_mode) || "INFORMATIVE";
        const g = judgeSeedGrounding({
          concrete_subject: String(b.concrete_subject || ""),
          point_or_tension: b.point_or_tension ? String(b.point_or_tension) : undefined,
          editorial_mode: mode,
          cluster: b.cluster ? String(b.cluster) : undefined,
          creator_evidence_available: !!b.creator_evidence_available,
          experience_required: !!b.experience_required,
          primary_source: b.primary_source ? String(b.primary_source) : undefined,
          evidence_source_ids: Array.isArray(b.evidence_source_ids) ? b.evidence_source_ids.map(String) : undefined,
          relationship_evidence_ids: Array.isArray(b.relationship_evidence_ids)
            ? b.relationship_evidence_ids.map(String)
            : undefined,
          verified_locations: Array.isArray(b.verified_locations) ? b.verified_locations.map(String) : undefined,
          verified_entities: Array.isArray(b.verified_entities) ? b.verified_entities.map(String) : undefined,
        });
        if (!g.pass) {
          grounding_reject += 1;
          judged.push({
            ...b,
            status: "REJECTED",
            editorial_fit: "POOR",
            grounding_status: g.provenance.grounding_status,
            grounding_reasons: g.provenance.reasons,
            claim_types: g.provenance.claim_types,
            inference_type: g.provenance.inference_type,
            source_type: g.provenance.source_type,
          } as any);
          continue;
        }
        b.grounding_status = g.provenance.grounding_status;
        b.grounding_reasons = g.provenance.reasons;
        b.claim_types = g.provenance.claim_types;
        b.inference_type = g.provenance.inference_type;
        b.source_type = g.provenance.source_type;
        const q = evaluateEditorialSeedQuality(b, mode);
        if (!q.pass) {
          judged.push({ ...b, status: "HOLD", editorial_fit: "POOR" });
          continue;
        }
        judged.push({
          ...b,
          status: isSelectableStatus(b.status) ? b.status : "ELIGIBLE",
          editorial_fit: "ACCEPTABLE",
          requested_editorial_mode: mode,
        });
      }
      return json({
        success: true,
        phase: "judge",
        judged,
        engine: WEEKLY_ENGINE_VERSION,
        diagnostics: {
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          grounding_reject,
          order8d_functional_restore: true,
          xai_api_used: false,
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
        },
      });
    }

    if (phase === "select") {
      const seedsIn: ConcreteSeed[] = seedArrayFromBody(body) as ConcreteSeed[];
      const mix = allocateEditorialSlots(required_slots, body.editorial_ratio || undefined);
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { data: acts } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, origin, system_origin_class, meta, x_post_id")
        .gte("published_at", since)
        .limit(500);
      const recentManualSelect: RecentManualPost[] = (acts || [])
        .map((row: any) => ({
          text: String(row.text_body || "").trim(),
          source_id: row.x_post_id,
          published_at: row.published_at,
          post_type: String(row.post_type || row.action_type || ""),
        }))
        .filter((r: RecentManualPost) => r.text.length >= 12);
      let pool: ConcreteSeed[] = [];
      for (const s of seedsIn) {
        if (!s?.concrete_subject) continue;
        if (!isSelectableStatus(s.status as any)) continue;
        const role = ((s as any).source_role as SourceRole) || "SEED_SOURCE";
        if (!isSeedEligibleRole(role)) continue;
        const g = guardCandidateAgainstManualLeakage({
          source_role: role,
          concrete_subject: String(s.concrete_subject || ""),
          point_or_tension: s.point_or_tension ? String(s.point_or_tension) : undefined,
          recent_manual: recentManualSelect,
          user_explicit: role === "USER_EXPLICIT_SEED",
        });
        if (!g.allow_as_seed) continue;
        pool.push(s);
      }
      const usedModes: Record<string, number> = {};
      const selectedWeekly: ConcreteSeed[] = [];
      const queue = buildEditorialQueue(mix.allocation as any);
      const outDays: Array<{ dayOffset: number; posts: any[] }> = Array.from({ length: daysCount }, (_, i) => ({
        dayOffset: i,
        posts: [],
      }));
      for (const plannedMode of queue) {
        const mode = plannedMode as EditorialMode;
        const candidates = pool
          .map((s, i) => ({ s, i, div: conceptualDiversityScore(s, selectedWeekly) }))
          .filter(({ s }) => canServeEditorialMode(s, mode))
          .sort((a, b) => b.div - a.div);
        let picked: ConcreteSeed | null = null;
        for (const { s, i } of candidates) {
          if (conceptualRepetitionLevel(s, selectedWeekly) === "HIGH") continue;
          picked = s;
          pool.splice(i, 1);
          break;
        }
        if (!picked) continue;
        selectedWeekly.push(picked);
        usedModes[mode] = (usedModes[mode] || 0) + 1;
        let bestDay = 0;
        let bestScore = 1e9;
        for (let d = 0; d < daysCount; d++) {
          if (outDays[d].posts.length >= postsPerDay) continue;
          const n = outDays[d].posts.filter(
            (p) => majorKey(p.cluster, p.concrete_subject) === majorKey(picked!.cluster, picked!.concrete_subject)
          ).length;
          const score = n * 10 + outDays[d].posts.length;
          if (score < bestScore) {
            bestScore = score;
            bestDay = d;
          }
        }
        if (outDays[bestDay].posts.length >= postsPerDay) {
          for (let d = 0; d < daysCount; d++) {
            if (outDays[d].posts.length < postsPerDay) {
              bestDay = d;
              break;
            }
          }
        }
        outDays[bestDay].posts.push(compactSlotLite(picked, bestDay, outDays[bestDay].posts.length + 1, mode));
      }
      let flatCount = outDays.reduce((s, d) => s + d.posts.length, 0);
      const baseNeed = mix.base_required_slots;
      while (flatCount < baseNeed && pool.length > 0) {
        let minD = 0;
        for (let i = 1; i < outDays.length; i++) {
          if (outDays[i].posts.length < outDays[minD].posts.length) minD = i;
        }
        if (outDays[minD].posts.length >= postsPerDay) break;
        const idx = pool.findIndex((s) => isSelectableStatus(s.status as any));
        if (idx < 0) break;
        const seed = pool.splice(idx, 1)[0];
        const mode = (WEEKLY_EDITORIAL_MODES.find((m) => canServeEditorialMode(seed, m)) || "INFORMATIVE") as EditorialMode;
        selectedWeekly.push(seed);
        outDays[minD].posts.push(compactSlotLite(seed, minD, outDays[minD].posts.length + 1, mode));
        usedModes[mode] = (usedModes[mode] || 0) + 1;
        flatCount++;
      }
      const redistributed = redistributeDailyTopics(outDays, postsPerDay);
      for (let di = 0; di < redistributed.days.length; di++) {
        redistributed.days[di].posts.forEach((p: any, si: number) => {
          p.dayOffset = di;
          p.slotId = `D${di + 1}P${si + 1}`;
        });
      }
      const totalPlanned = redistributed.days.reduce((s, d) => s + d.posts.length, 0);
      return json({
        success: true,
        phase: "select",
        days: redistributed.days,
        totalPlanned,
        mode_supply_low: totalPlanned < baseNeed,
        topic_supply_low: pool.length === 0 && totalPlanned < required_slots,
        editorial_mix: {
          base_required_slots: mix.base_required_slots,
          final_slots_target: mix.final_slots,
          allocation: mix.allocation,
          used_modes: usedModes,
          weekly_humor: 0,
        },
        diagnostics: {
          required_slots,
          app_version: APP_VERSION,
          weekly_engine_version: WEEKLY_ENGINE_VERSION,
          generator_version: GENERATOR_VERSION,
          git_commit: GIT_COMMIT,
          engine: WEEKLY_ENGINE_VERSION,
          input_seed_count: seedsIn.length,
          count_integrity: countIntegrityOk(mix.base_required_slots, totalPlanned),
          order8d_functional_restore: true,
          order8d_cors_methods: true,
          order8d_note: "full compactSlot/ORDER7-8 path re-materializing; slots planned with lite compact",
          soft_daily_cap: softDailyCap(postsPerDay),
          max_daily_topic: redistributed.max_daily_topic,
          topic_distribution: topicDistributionReport(redistributed.days),
          xai_usage: { seed_expansion: false, external_supplement: false, creator_generation: false },
        },
        timing: { total_ms: Date.now() - t0 },
      });
    }

    return json(
      { success: false, error: "phase required: expand | judge | select", engine: WEEKLY_ENGINE_VERSION, days: [] },
      400
    );
  } catch (err: any) {
    console.error(err);
    return json({ success: false, error: String(err?.message || err).slice(0, 200), days: [] }, 500);
  }
});
