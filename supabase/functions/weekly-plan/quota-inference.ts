/**
 * Infer the week's post quota from Creator DNA + engine rules + learned cadence.
 * Will is not a generate-box sentence. Bounds exist only as X anti-dump safety.
 */
import type { CadenceSignal, ClusterWeight, LearningState } from "./seed-engine.ts";
import { creatorDnaBlock, engineRulesAsWill, performanceDnaBlock } from "./engine-dna.ts";

export const QUOTA_DAYS = 7;
/** X anti-dump ceiling — strategy reference, not a content template. */
export const QUOTA_PER_DAY_MAX = 8;
/** Floor so a 7-day generate is still a growth week, not a 1-post drip. */
export const QUOTA_PER_DAY_MIN = 3;
export const QUOTA_INFERENCE_VERSION = "weekly_quota_v1";

export type WeeklyQuota = {
  posts_per_day: number;
  days: typeof QUOTA_DAYS;
  required_slots: number;
  rationale: string;
  source: "GROK_INFERRED" | "CADENCE_FALLBACK";
  version: string;
  grok_error?: string;
};

function clampPostsPerDay(n: number): number {
  const x = Math.round(Number(n) || 0);
  return Math.min(QUOTA_PER_DAY_MAX, Math.max(QUOTA_PER_DAY_MIN, Number.isFinite(x) ? x : QUOTA_PER_DAY_MIN));
}

function extractJson(raw: string): any {
  const txt = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(txt);
  } catch {}
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(txt.slice(a, b + 1));
    } catch {}
  }
  return null;
}

export function quotaFromCadence(cadence: CadenceSignal, intentText?: string): WeeklyQuota {
  const avg = Number(cadence?.avg_originals_on_active_days) || 0;
  const last14 = Number(cadence?.originals_last_14d) || 0;
  let ppd = 4;
  if (avg >= 5) ppd = 5;
  else if (avg >= 3) ppd = Math.round(avg);
  else if (last14 >= 28) ppd = 5;
  if (intentText && /적게|줄여|하루\s*3/.test(intentText)) ppd = Math.min(ppd, 3);
  if (intentText && /많이|성장|채워|하루\s*5|5개/.test(intentText)) ppd = Math.max(ppd, 5);
  ppd = clampPostsPerDay(ppd);
  return {
    posts_per_day: ppd,
    days: QUOTA_DAYS,
    required_slots: ppd * QUOTA_DAYS,
    rationale: `cadence fallback: avg_active=${avg} last14=${last14} → ${ppd}/day × ${QUOTA_DAYS}`,
    source: "CADENCE_FALLBACK",
    version: QUOTA_INFERENCE_VERSION,
  };
}

export async function inferWeeklyQuota(args: {
  xaiKey: string;
  cadence: CadenceSignal;
  clusterWeights: ClusterWeight[];
  userDirectN: number;
  performanceHints?: string[];
  learning?: LearningState;
  explicitCreatorIntent?: string;
  model?: string;
  timeoutMs?: number;
}): Promise<WeeklyQuota> {
  const fallback = quotaFromCadence(args.cadence, args.explicitCreatorIntent);
  if (!args.xaiKey) return fallback;

  const system = [
    "You infer the weekly ORIGINAL post quota for X account @Seung4680.",
    "Will is already in Creator DNA + engine rules. Do not wait for a typed slogan.",
    "this_run_note is an optional overlay, not the will.",
    "Reference the X algorithm for STRATEGY only: anti-dump (stacked originals become noise; same-author decay per For You refresh), 48-hour For You freshness, start 14:00 America/Los_Angeles, even-spread inside 14:00–22:00 PT, mix, whether higher volume linked to growth.",
    "X ranking weights multiply predicted viewer-action probabilities on Home-served posts, not raw engagement counts and not author DMs of own links. They do not write posts and do not pick the last sentence.",
    "Days are 7 because 7-day generate is the engine action.",
    `Infer posts_per_day as an integer between ${QUOTA_PER_DAY_MIN} and ${QUOTA_PER_DAY_MAX}. Prefer 4/day. 5 fills the 14:00–22:00 PT window. Not a frozen 5. Do not freeze 6 as a default.`,
    "Thin or missing learned evidence is expected (cold start). Still infer posts_per_day from DNA + cadence within bounds. Do not refuse. Do not wait for validated performance patterns.",
    "If handmade cadence is healthy and the 14:00–22:00 PT window has room, 5 is enough. Go to 6–8 only if dumping is unlikely. If dumping likely hurt reach, stay at 3–4.",
    "Do not copy 6 just because an old example used 6. Prefer 4.",
    "Korean rationale, one or two sentences.",
    'Output strict JSON: {"posts_per_day":4,"rationale":"..."}',
  ].join("\n");

  const user = JSON.stringify({
    creator_dna: creatorDnaBlock(),
    engine_rules_are_the_will: engineRulesAsWill(),
    performance_dna: performanceDnaBlock(),
    this_run_note_overlay_only: args.explicitCreatorIntent || null,
    user_direct_n: args.userDirectN,
    cadence: args.cadence,
    cluster_weights: args.clusterWeights,
    performance_pattern_hints: (args.performanceHints || []).slice(0, 8),
    learning: args.learning || null,
    week_days: QUOTA_DAYS,
    bounds: { min_per_day: QUOTA_PER_DAY_MIN, max_per_day: QUOTA_PER_DAY_MAX },
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 18000);
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${args.xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model || "grok-4.6",
        temperature: 0.3,
        max_tokens: 250,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    clearTimeout(timer);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ...fallback,
        grok_error: String(body?.error?.message || `xai_http_${res.status}`).slice(0, 180),
      };
    }
    const content = body?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(typeof content === "string" ? content : JSON.stringify(content));
    if (!parsed || parsed.posts_per_day == null) {
      return { ...fallback, grok_error: "quota_json_unusable" };
    }
    const ppd = clampPostsPerDay(Number(parsed.posts_per_day));
    const rationale = String(parsed?.rationale || "").replace(/\s+/g, " ").trim().slice(0, 240)
      || `Grok inferred ${ppd}/day × ${QUOTA_DAYS}`;
    return {
      posts_per_day: ppd,
      days: QUOTA_DAYS,
      required_slots: ppd * QUOTA_DAYS,
      rationale,
      source: "GROK_INFERRED",
      version: QUOTA_INFERENCE_VERSION,
    };
  } catch (e: any) {
    return {
      ...fallback,
      grok_error: e?.name === "AbortError" ? "xai_timeout" : String(e?.message || "quota_grok_failed").slice(0, 180),
    };
  }
}
