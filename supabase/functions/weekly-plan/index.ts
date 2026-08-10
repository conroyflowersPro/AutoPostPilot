/**
 * Weekly Planner Edge — Screenshot 1/day + Strategic remainder (5–8 total)
 * Concrete topic candidates from Fedica; no keyword→prompt dump.
 * LAFC: BMO home = 직관. No silent fallback.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "grok-4.5";
const POSTS_MIN = 5;
const POSTS_MAX = 8;
const POSTS_TARGET = 6;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CREATOR_DNA = `creator-dna-v1.3.1: Korean Tesla owner (Cybertruck primary); FSD observation; LAFC STH; gaming/daily ok; no stock daytrade; no invented tests; 해요체+casual.`;
const PERF_DNA = `perf candidates VALIDATED=0 soft only; followers>profile>bookmarks>replies>likes>impressions; never learn from drafts.`;

type Weight = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";

function normWeight(w: string | undefined, rank: number): Weight {
  const u = String(w || "").toUpperCase();
  if (u.includes("VERY")) return "VERY_HIGH";
  if (u === "HIGH") return "HIGH";
  if (u === "LOW") return "LOW";
  if (rank <= 1) return "VERY_HIGH";
  if (rank <= 3) return "HIGH";
  if (rank <= 6) return "MEDIUM";
  return "LOW";
}

function buildCandidates(ranked: any[], interests: string[], topInterest: string | null) {
  const clusters: Record<string, { id: string; label: string; kws: string[]; w: Weight }> = {};
  for (const r of ranked) {
    const kw = String(r.keyword || "").trim();
    if (!kw) continue;
    const k = kw.toLowerCase();
    let id = "OTHER";
    let label = "Other signal";
    if (/elon|musk/.test(k)) { id = "MUSK_PUBLIC"; label = "Musk public discourse"; }
    else if (/cybercab|robotaxi|fsd|hw3|autonom/.test(k)) { id = "AUTONOMY"; label = "Autonomy/FSD/Cybercab"; }
    else if (/starlink|spacex|starship/.test(k)) { id = "SPACEX"; label = "SpaceX/Starlink"; }
    else if (/optimus|humanoid/.test(k)) { id = "ROBOTICS"; label = "Optimus/robotics"; }
    else if (/terafab|megapack|cybertruck|tesla|semi/.test(k)) { id = "TESLA_PRODUCT"; label = "Tesla product/mfg"; }
    else if (/xai|grok|bandwidth|ai /.test(k)) { id = "AI_INFRA"; label = "AI infrastructure"; }
    else if (/lafc|mls/.test(k)) { id = "LAFC"; label = "LAFC"; }
    const w = normWeight(r.relativeWeight, Number(r.visualRank) || 99);
    if (!clusters[id]) clusters[id] = { id, label, kws: [], w };
    if (!clusters[id].kws.includes(kw)) clusters[id].kws.push(kw);
  }
  const list = Object.values(clusters);
  const order = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW"];
  list.sort((a, b) => order.indexOf(a.w) - order.indexOf(b.w));
  return list.map((c, i) => {
    let subject = topInterest || interests[0] || c.label;
    let angle = "audience signal → creator analysis; no keyword stuffing";
    let sufficiency = "READY";
    if (c.id === "MUSK_PUBLIC") {
      subject = "Musk/Tesla 생태계 공개 담론 해석";
      angle = "주가 없이 제품·비전 맥락";
    } else if (c.id === "AUTONOMY") {
      subject = "자율주행·Cybercab 담론 관찰";
      angle = "체험 허구 금지";
    } else if (c.id === "SPACEX") {
      subject = "SpaceX/Starlink 관심 신호";
      angle = "가짜 일정 금지";
      sufficiency = "NEEDS_CONTEXT";
    } else if (c.id === "TESLA_PRODUCT") {
      subject = "Tesla 제품·제조 관심 신호";
      angle = "오너/관찰 톤";
    } else if (c.id === "AI_INFRA") {
      subject = "AI 인프라 담론 한 가지 포인트";
      angle = "키워드 나열 금지";
    } else if (c.id === "ROBOTICS") {
      subject = "Optimus/로보틱스 장기 프레임";
      angle = "체험 허구 금지";
    }
    return {
      id: `ss_${i}`,
      source_keywords: c.kws.slice(0, 6),
      semantic_cluster: c.id,
      strength: c.w,
      concrete_subject: subject,
      proposed_angle: angle,
      context_sufficiency: sufficiency,
    };
  });
}

function pickDailyScreenshot(cands: any[], day: number, used: string[]) {
  const usable = cands.filter((c) => c.context_sufficiency === "READY" || c.strength === "VERY_HIGH" || c.strength === "HIGH");
  const pool = usable.length ? usable : cands;
  if (!pool.length) return null;
  for (const c of pool) {
    if (!used.includes(c.semantic_cluster)) {
      used.push(c.semantic_cluster);
      return c;
    }
  }
  return pool[day % pool.length];
}

const SYSTEM = `You plan ORIGINAL X posts for @Seung4680 for specific dayOffsets.
JSON only, no markdown.
Schema:
{"rationale":"short ko","days":[{"dayOffset":0,"posts":[{"slotId":"D1P1","primaryTopic":"구체 주제","angle":"...","contentType":"observation","targetLength":"medium","actionType":"ORIGINAL","planning_source":"STRATEGIC","audienceLinked":false,"lafc":null}]}]}

Rules:
- Exactly the requested number of STRATEGIC posts per day (planning_source STRATEGIC, audienceLinked false).
- primaryTopic concrete Korean — NEVER "creator-framed" or raw Fedica keywords.
- Screenshot-derived slots are ADDED by the server — do NOT create SCREENSHOT_DERIVED posts yourself.
- LAFC: label MLS|LeaguesCup|Playoffs|CONCACAF; BMO home = 직관; away = 비직관; offweek 1-2 LAFC OK in strategic set.
- No stock chatter. No invented firsthand tests.
- Diversity: do not make all strategic slots Tesla/Musk even if audience is Tesla-heavy.`;

function extractJson(raw: string): any | null {
  let t = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(t); } catch {}
  const s = t.indexOf("{");
  if (s < 0) return null;
  let d = 0, e = -1;
  for (let i = s; i < t.length; i++) {
    if (t[i] === "{") d++;
    else if (t[i] === "}") { d--; if (d === 0) { e = i; break; } }
  }
  if (e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch {} }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing Authorization", fallback: true, days: [] }, 401);
    const xaiKey = Deno.env.get("XAI_API_KEY");
    if (!xaiKey) return json({ success: false, error: "XAI_API_KEY missing", fallback: true, days: [] }, 500);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Not authenticated", fallback: true, days: [] }, 401);

    const body = await req.json().catch(() => ({}));
    const daysCount = Math.min(Math.max(Number(body.generationDays) || 7, 1), 7);
    const postsPerDay = Math.min(POSTS_MAX, Math.max(POSTS_MIN, Number(body.postsPerDay) || POSTS_TARGET));
    const topic = String(body.topic || body.creatorIntent || body.mergedKeywords || "").trim();
    const interests = Array.isArray(body.interests) ? body.interests.map(String).slice(0, 10) : [];
    const categories = Array.isArray(body.topicCategories) ? body.topicCategories.map(String).slice(0, 8) : [];
    const published = Array.isArray(body.publishedTopics) ? body.publishedTopics.map(String).slice(0, 8) : [];
    const scheduled = Array.isArray(body.scheduledTopics) ? body.scheduledTopics.map(String).slice(0, 6) : [];
    const topKeyword = typeof body.topKeyword === "string" && body.topKeyword.trim() ? body.topKeyword.trim() : null;
    const topKeywordInterest = typeof body.topKeywordInterest === "string" ? body.topKeywordInterest.trim() : null;
    const ranked = Array.isArray(body.rankedKeywords)
      ? body.rankedKeywords.map((r: any, i: number) => ({
          keyword: String(r?.keyword || "").trim(),
          visualRank: Number(r?.visualRank) || i + 1,
          relativeWeight: String(r?.relativeWeight || "medium"),
        })).filter((r: any) => r.keyword)
      : [];

    const candidates = buildCandidates(ranked, interests, topKeywordInterest);
    const hasScreenshotSignal = Boolean(topKeyword || ranked.length || interests.length);
    const usedClusters: string[] = [];
    const screenshotByDay: (any | null)[] = [];
    for (let d = 0; d < daysCount; d++) {
      if (!hasScreenshotSignal) {
        screenshotByDay.push(null);
        continue;
      }
      const pick = pickDailyScreenshot(candidates, d, usedClusters);
      if (!pick || pick.context_sufficiency === "REJECTED") {
        screenshotByDay.push(null);
      } else {
        screenshotByDay.push(pick);
      }
    }

    const dna_sources = {
      creator: "runtime_snapshot",
      performance: "baseline_candidates",
      runtime: "weekly_plan_screenshot_one_per_day",
      topKeyword: topKeyword || null,
      screenshot_policy: "exactly_1_per_day_when_usable_else_strategic_replace",
      posts_per_day: postsPerDay,
      candidates: candidates.length,
    };

    const shared = `Intent: ${topic || "(none)"}
Interests: ${interests.join(", ") || "(none)"}
Categories: ${categories.join(", ") || "(none)"}
${CREATOR_DNA}
${PERF_DNA}
Published avoid: ${published.join(" | ") || "(none)"}
Scheduled avoid: ${scheduled.join(" | ") || "(none)"}
NOTE: Server adds at most 1 SCREENSHOT_DERIVED slot/day from Fedica concrete candidates. You only plan STRATEGIC slots.
Screenshot clusters already used for audience slots (do not monopolize strategic with same): ${[...new Set(screenshotByDay.filter(Boolean).map((c: any) => c.semantic_cluster))].join(", ") || "(none)"}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    const offsets = Array.from({ length: daysCount }, (_, i) => i);
    const stratCount = hasScreenshotSignal ? Math.max(4, postsPerDay - 1) : postsPerDay;

    const userPrompt = `${shared}

Plan dayOffsets ${offsets.join(", ")}.
Each day: exactly ${stratCount} STRATEGIC posts (planning_source STRATEGIC).
Concrete primaryTopic. JSON only.`;

    let rawText = "";
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${xaiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.4,
          max_tokens: 5000,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        return json({ success: false, error: `xAI ${res.status}`, detail: (await res.text()).slice(0, 300), fallback: true, days: [], dna_sources }, 502);
      }
      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content || "";
    } catch (e: any) {
      clearTimeout(timer);
      return json({
        success: false,
        error: "주간 계획 생성에 실패했습니다. 자동 대체 계획으로 초안을 생성하지 않습니다.",
        detail: e?.name === "AbortError" ? "timeout" : String(e?.message || e).slice(0, 160),
        fallback: true,
        days: [],
        dna_sources,
      }, 503);
    }

    const parsed = extractJson(rawText);
    let days: any[] = Array.isArray(parsed?.days) ? parsed.days : [];
    if (!days.length) {
      return json({
        success: false,
        error: "주간 계획 결과가 비어 있습니다.",
        detail: `raw_preview=${rawText.slice(0, 280)}`,
        fallback: true,
        days: [],
        dna_sources,
      }, 503);
    }

    const outDays = [];
    for (let i = 0; i < daysCount; i++) {
      const d = days.find((x: any) => x.dayOffset === i) || days[i] || { dayOffset: i, posts: [] };
      let posts = Array.isArray(d.posts) ? d.posts : [];
      posts = posts.slice(0, stratCount).map((p: any, pi: number) => {
        let topicP = String(p.primaryTopic || "").trim();
        if (!topicP || /^creator-framed$/i.test(topicP)) topicP = String(p.angle || "구체 관찰 한 가지").slice(0, 80);
        let lafc = null;
        if (p.lafc && typeof p.lafc === "object") {
          const venue = String(p.lafc.venue || "unknown");
          let attendance = String(p.lafc.attendance || "비직관");
          if (/bmo/i.test(venue) || /home/i.test(venue)) attendance = "직관";
          lafc = {
            competition: String(p.lafc.competition || "MLS"),
            venue,
            attendance,
            matchPhase: String(p.lafc.matchPhase || "offweek"),
          };
        }
        return {
          slotId: String(p.slotId || `D${i + 1}S${pi + 1}`),
          primaryTopic: topicP.slice(0, 100),
          angle: String(p.angle || "").slice(0, 140),
          contentType: String(p.contentType || (lafc ? "lafc" : "observation")),
          targetLength: ["short", "medium", "long"].includes(p.targetLength) ? p.targetLength : "medium",
          actionType: "ORIGINAL",
          planning_source: "STRATEGIC",
          audienceLinked: false,
          lafc,
          postBrief: {
            source: "STRATEGIC",
            concrete_subject: topicP,
            why_this_topic: "strategic weekly plan",
            context: "",
            creator_angle: String(p.angle || ""),
            audience_connection: "",
            core_point: topicP,
            known_facts: [],
            do_not_invent: ["first-person tests without evidence", "stock calls"],
            writing_mode: "concrete",
          },
          forbiddenTopics: ["주가", "등락"],
          allowedContext: [],
          postStrategy: {
            strategicAngle: String(p.angle || topicP).slice(0, 100),
            writingApproach: "concrete",
            experienceUsage: "none",
            hypothesisNote: "Hypothesis only",
          },
        };
      });

      const ss = screenshotByDay[i];
      let screenshot_slot_replaced = false;
      if (ss) {
        const brief = {
          source: "SCREENSHOT_DERIVED",
          source_keywords: ss.source_keywords,
          source_cluster: ss.semantic_cluster,
          concrete_subject: ss.concrete_subject,
          why_this_topic: "Fedica weekly audience signal",
          context: "relative visual keyword weight only",
          creator_angle: ss.proposed_angle,
          audience_connection: `strength ${ss.strength}`,
          core_point: ss.concrete_subject,
          known_facts: [`keywords: ${ss.source_keywords.join(", ")}`],
          do_not_invent: ["quotes", "dates", "mention counts", "first-person tests"],
          writing_mode: "concrete_observation_or_analysis",
          selection_reason: `cluster ${ss.semantic_cluster}`,
        };
        posts.unshift({
          slotId: `D${i + 1}SS1`,
          primaryTopic: ss.concrete_subject.slice(0, 100),
          angle: ss.proposed_angle.slice(0, 140),
          contentType: "audience_signal",
          targetLength: "medium",
          actionType: "ORIGINAL",
          planning_source: "SCREENSHOT_DERIVED",
          audienceLinked: true,
          lafc: null,
          postBrief: brief,
          forbiddenTopics: ["주가", "등락"],
          allowedContext: [],
          postStrategy: {
            strategicAngle: ss.proposed_angle.slice(0, 100),
            writingApproach: "concrete",
            experienceUsage: "none",
            hypothesisNote: "Signal only — no invented context",
          },
        });
      } else if (hasScreenshotSignal) {
        screenshot_slot_replaced = true;
      }

      posts = posts.slice(0, postsPerDay);
      outDays.push({
        dayOffset: i,
        posts,
        meta: {
          screenshot_slot_replaced,
          screenshot_cluster: ss?.semantic_cluster || null,
        },
      });
    }

    return json({
      success: true,
      model: MODEL,
      generationDays: daysCount,
      days: outDays,
      rationale: parsed?.rationale || null,
      totalPlanned: outDays.reduce((s, d) => s + d.posts.length, 0),
      dna_sources,
      fallback: false,
      engine: "weekly_plan_screenshot_one_per_day",
      screenshot_summary: {
        keywords_detected: ranked.length,
        usable_clusters: candidates.length,
        topKeyword: topKeyword || null,
        policy: "1 screenshot-derived/day when usable; else strategic replace",
      },
    });
  } catch (err: any) {
    console.error(err);
    return json({
      success: false,
      error: "주간 계획 생성에 실패했습니다. 자동 대체 계획으로 초안을 생성하지 않습니다.",
      detail: String(err?.message || err).slice(0, 160),
      fallback: true,
      days: [],
    }, 500);
  }
});
