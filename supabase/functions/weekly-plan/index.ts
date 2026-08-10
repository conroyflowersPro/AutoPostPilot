/**
 * Weekly Planner Edge v9.1.0 — PHASED (expand | judge | select)
 * Architecture: no production bootstrap templates; integrity [base, base+1];
 * daily topic softCap 0.4; Weekly HUMOR = 0; no auto xAI fill.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  DIMENSION_REGISTRY,
  applyLocalGates,
  extractJson,
  subjectSignature,
  consolidateSemanticGroups,
  createSeedIdFactory,
  isSelectableStatus,
  canServeEditorialMode,
  buildModeSupplyReport,
  parseEditorialMode,
  WEEKLY_EDITORIAL_MODES,
  evaluateEditorialSeedQuality,
  ideaAngleKey,
  ideaAngleGuardAllow,
  conceptualDiversityScore,
  conceptualRepetitionLevel,
  bootstrapCandidatesFromDimensions,
  type ConcreteSeed,
} from "./seed-engine.ts";
import {
  allocateEditorialSlots,
  buildEditorialQueue,
  lengthForEditorial,
  type EditorialMode,
} from "./editorial-mix.ts";
import {
  analyzeCreatorIntent14d,
  blendInterestMix,
  DEFAULT_INTEREST_MIX,
} from "./creator-intent-14d.ts";
import {
  buildRecentExperienceCandidates,
  resolveExperienceSupply,
  experienceCandidateToSeedFields,
  ARCHIVE_EXPERIENCE_FALLBACK,
} from "./experience-evidence.ts";
import {
  redistributeDailyTopics,
  topicDistributionReport,
  softDailyCap,
} from "./daily-topic-distribute.ts";

const POSTS_MIN = 5;
const POSTS_MAX = 8;
const POSTS_TARGET = 6;
const MODEL = "grok-4.5";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function compactSlot(seed: ConcreteSeed, dayOffset: number, slot: number, mode: EditorialMode) {
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
  };
}

async function callXai(xaiKey: string, system: string, user: string, maxTokens: number, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.35,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`xAI ${res.status}`);
    const data = await res.json();
    return String(data?.choices?.[0]?.message?.content || "");
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
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
    const xaiKey = Deno.env.get("XAI_API_KEY") || "";
    const allowEnrich = body.allow_xai_enrich === true || body.explicit_xai === true;
    const t0 = Date.now();

    if (phase === "expand") {
      const published = Array.isArray(body.publishedTopics) ? body.publishedTopics.map(String) : [];
      const intentText = String(body.creatorIntent || body.topic || "").trim();
      const local = bootstrapCandidatesFromDimensions({ publishedSubjects: published, intentText });
      const nextId = createSeedIdFactory("s");
      const gated = applyLocalGates(local, published.map(subjectSignature), nextId);
      let xaiSeeds: any[] = [];
      if (allowEnrich && xaiKey && body.expand_with_xai === true) {
        const dims = DIMENSION_REGISTRY.slice(0, 8);
        const sys = "Return JSON {seeds:[{cluster,dimension,concrete_subject,point_or_tension}]} only. No generic AI advice.";
        const userP = `Expand dimensions: ${JSON.stringify(dims)}. Korean concrete subjects. Weekly HUMOR forbidden.`;
        try {
          const raw = await callXai(xaiKey, sys, userP, 2000, 45000);
          const parsed = extractJson(raw);
          xaiSeeds = Array.isArray(parsed?.seeds) ? parsed.seeds : [];
        } catch {
          xaiSeeds = [];
        }
      }
      const xaiGated = applyLocalGates(xaiSeeds, published.map(subjectSignature), nextId);
      const candidates = [...gated.passed, ...xaiGated.passed];
      return json({
        success: true,
        phase: "expand",
        candidates,
        expand_done: true,
        engine: "phased_v9.1.0",
        note: "Production bootstrap templates disabled. expand_with_xai requires explicit flag.",
        timing: { total_ms: Date.now() - t0 },
      });
    }

    if (phase === "judge") {
      const batch = Array.isArray(body.seeds) ? body.seeds : [];
      const judged: ConcreteSeed[] = [];
      for (const b of batch) {
        const mode = parseEditorialMode(b.requested_editorial_mode) || "INFORMATIVE";
        const q = evaluateEditorialSeedQuality(b, mode);
        if (!q.pass) {
          judged.push({ ...b, status: "HOLD", editorial_fit: "POOR" });
          continue;
        }
        judged.push({
          ...b,
          status: isSelectableStatus(b.status) ? b.status : "ELIGIBLE",
          editorial_fit: "ACCEPTABLE",
        });
      }
      return json({
        success: true,
        phase: "judge",
        judged: consolidateSemanticGroups(judged),
        engine: "phased_v9.1.0",
      });
    }

    if (phase === "select") {
      const seedsIn: ConcreteSeed[] = Array.isArray(body.seeds) ? body.seeds : [];
      const editorialRatio = body.editorial_ratio || undefined;
      const mix = allocateEditorialSlots(required_slots, editorialRatio);
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { data: acts } = await supabase
        .from("account_activities")
        .select("text_body, post_type, action_type, published_at, origin, system_origin_class, meta, x_post_id")
        .gte("published_at", since)
        .limit(500);
      const intent = analyzeCreatorIntent14d(acts || []);
      const interestMix = blendInterestMix(DEFAULT_INTEREST_MIX, intent);
      const recentExp = buildRecentExperienceCandidates(acts || []);
      const expNeed = Math.max(0, Number((mix.allocation as any)?.EXPERIENCE) || 0);
      const expResolved = resolveExperienceSupply(
        expNeed,
        recentExp,
        recentExp.length ? [] : ARCHIVE_EXPERIENCE_FALLBACK
      );
      let pool: ConcreteSeed[] = seedsIn.filter((s) => isSelectableStatus(s.status as any));
      const nextId = createSeedIdFactory("e");
      for (const c of expResolved.selected) {
        const fields = experienceCandidateToSeedFields(c);
        pool.unshift({
          seed_id: nextId(),
          cluster: String(fields.cluster || "OTHER"),
          dimension: String(fields.dimension || "EXPERIENCE"),
          concrete_subject: String(fields.concrete_subject || ""),
          subject_signature: subjectSignature(String(fields.concrete_subject || "")),
          creator_evidence_available: true,
          status: "HIGH_VALUE",
          primary_source: String(fields.provenance || fields.primary_source || "RECENT_MANUAL_14D"),
          point_or_tension: fields.point_or_tension as string | undefined,
        } as ConcreteSeed);
      }
      const usedModes: Record<string, number> = {};
      const selectedWeekly: ConcreteSeed[] = [];
      const queue = buildEditorialQueue(mix.allocation as any);
      const modeSupply = buildModeSupplyReport(pool, WEEKLY_EDITORIAL_MODES as any);
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
          const guard = ideaAngleGuardAllow(s, selectedWeekly);
          if (!guard.allow) continue;
          picked = s;
          pool.splice(i, 1);
          break;
        }
        if (!picked) {
          for (const { s, i } of candidates) {
            const guard = ideaAngleGuardAllow(s, selectedWeekly, { softSecond: true });
            if (!guard.allow) continue;
            if (conceptualRepetitionLevel(s, selectedWeekly) === "HIGH") continue;
            picked = s;
            pool.splice(i, 1);
            break;
          }
        }
        if (!picked) continue;
        selectedWeekly.push(picked);
        usedModes[mode] = (usedModes[mode] || 0) + 1;
        let bestDay = 0;
        let bestScore = 1e9;
        for (let d = 0; d < daysCount; d++) {
          if (outDays[d].posts.length >= postsPerDay) continue;
          const n = outDays[d].posts.filter((p) => majorKey(p.cluster, p.concrete_subject) === majorKey(picked!.cluster, picked!.concrete_subject)).length;
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
        outDays[bestDay].posts.push(compactSlot(picked, bestDay, outDays[bestDay].posts.length + 1, mode));
      }
      let flatCount = outDays.reduce((s, d) => s + d.posts.length, 0);
      let integrity_fills = 0;
      let xai_supplement_would_be_required = 0;
      const baseNeed = mix.base_required_slots;
      while (flatCount < baseNeed && pool.length > 0) {
        let minD = 0;
        for (let i = 1; i < outDays.length; i++) {
          if (outDays[i].posts.length < outDays[minD].posts.length) minD = i;
        }
        if (outDays[minD].posts.length >= postsPerDay) break;
        const underModes = WEEKLY_EDITORIAL_MODES.filter((m) => (usedModes[m] || 0) < (mix.allocation as any)[m]);
        const tryModes = underModes.length ? underModes : WEEKLY_EDITORIAL_MODES.filter((m) => m !== "EXPERIENCE");
        let filled = false;
        for (const m of tryModes) {
          const idx = pool.findIndex((s) => canServeEditorialMode(s, m) && isSelectableStatus(s.status as any));
          if (idx < 0) continue;
          const seed = pool.splice(idx, 1)[0];
          const guard = ideaAngleGuardAllow(seed, selectedWeekly, { softSecond: true });
          if (!guard.allow && selectedWeekly.length > 0) {
            pool.push(seed);
            continue;
          }
          selectedWeekly.push(seed);
          outDays[minD].posts.push(compactSlot(seed, minD, outDays[minD].posts.length + 1, m as EditorialMode));
          usedModes[m] = (usedModes[m] || 0) + 1;
          integrity_fills++;
          flatCount++;
          filled = true;
          break;
        }
        if (!filled) break;
      }
      flatCount = outDays.reduce((s, d) => s + d.posts.length, 0);
      if (flatCount < baseNeed) {
        xai_supplement_would_be_required = baseNeed - flatCount;
      }
      const mode_shortfall: Record<string, number> = {};
      for (const m of WEEKLY_EDITORIAL_MODES) {
        const target = Number((mix.allocation as any)[m] || 0);
        const used = Number(usedModes[m] || 0);
        if (used < target) mode_shortfall[m] = target - used;
      }
      const redistributed = redistributeDailyTopics(outDays, postsPerDay);
      for (let di = 0; di < redistributed.days.length; di++) {
        redistributed.days[di].posts.forEach((p: any, si: number) => {
          p.dayOffset = di;
          p.slotId = `D${di + 1}P${si + 1}`;
        });
      }
      const totalPlanned = redistributed.days.reduce((s, d) => s + d.posts.length, 0);
      const count_shortfall = totalPlanned < baseNeed;
      const mode_supply_low = modeSupply.mode_supply_low || count_shortfall || xai_supplement_would_be_required > 0 || Object.values(mode_shortfall).some((n) => n > 0);
      return json({
        success: true,
        phase: "select",
        days: redistributed.days,
        totalPlanned,
        mode_supply_low,
        topic_supply_low: pool.length === 0 && totalPlanned < required_slots,
        interest_mix: interestMix,
        creator_intent: intent,
        editorial_mix: {
          base_required_slots: mix.base_required_slots,
          final_slots_target: mix.final_slots,
          allocation: mix.allocation,
          used_modes: usedModes,
          weekly_humor: 0,
        },
        diagnostics: {
          required_slots,
          integrity_fills,
          mode_shortfall,
          xai_supplement_would_be_required,
          xai_api_used: false,
          soft_daily_cap: softDailyCap(postsPerDay),
          max_daily_topic: redistributed.max_daily_topic,
          consecutive_same_topic_pairs: redistributed.consecutive_same_topic_pairs,
          topic_distribution: topicDistributionReport(redistributed.days),
          experience: expResolved.report,
          engine: "phased_v9.1.0",
        },
        timing: { total_ms: Date.now() - t0 },
      });
    }

    return json({
      success: false,
      error: "phase required: expand | judge | select",
      engine: "phased_v9.1.0",
      days: [],
    }, 400);
  } catch (err: any) {
    console.error(err);
    return json({ success: false, error: String(err?.message || err).slice(0, 200), days: [] }, 500);
  }
});
