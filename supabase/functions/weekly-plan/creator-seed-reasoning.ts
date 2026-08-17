/**
 * Creator-driven Seed Reasoning.
 * Will = Creator DNA + engine rules (not a generate-box sentence).
 * Does NOT emit DIMENSION_REGISTRY as production seed bodies.
 * Output = direction seeds only (no finished post prose).
 */
import { isUsableKeywordSubject, subjectSignature, type ConcreteSeed } from "./seed-engine.ts";
import { seedCollectorBounds } from "./engine-dna.ts";
import { seedCandidatePhilosophyBlock } from "./engine-stage-philosophy.ts";
import { isFrozenHumorClone } from "./humor-fill.ts";
import {
  isPublicSeedAdOrBait,
  PUBLIC_SEED_MIN_REPLIES,
  PUBLIC_SEED_SUPPLEMENT_IMPRESSIONS,
} from "./public-x-seed-search.ts";
import {
  deferOverweightDrivingFamily,
  hasUnseededDrivingBoltOn,
} from "./situation-diversity.ts";
import {
  inferPersonalCluster,
  isKoreaOnlySituation,
  isPersonalInterestSubject,
  isSlotTypeLabel,
  massSectorFromText,
  type OpenSeedSlot,
} from "./seed-scope.ts";

export const CREATOR_SEED_REASONING_VERSION = "creator_seed_collector_v1";

export type ViralCandidate = {
  text: string;
  engagement_hint?: string;
  source?: string;
};

export type CreatorSeedReasoningInput = {
  xaiKey: string;
  needed: number;
  existing: ConcreteSeed[];
  recentPublishedAngles?: string[];
  explicitCreatorIntent?: string;
  viralCandidates?: ViralCandidate[];
  model?: string;
  timeoutMs?: number;
  /** Short DNA-only retry when the full prompt returned zero usable seeds. */
  compactRetry?: boolean;
  /** Planner-requested field for a recovery expansion. Direction only; not selection. */
  explorationDirection?: string;
  /** Locked week cells from Planner. Count + intents; Seed still explores, does not select. */
  plannerSlotIntents?: Array<{
    slot_id?: string;
    day_offset?: number;
    editorial_mode?: string;
    planner_intent?: string;
    strategic_role?: string;
  }>;
  plannerRequestedCount?: number;
  /** Typed empty cells. If omitted, built from needed + existing. */
  openSlots?: OpenSeedSlot[];
  searchWindow?: { from: string; to: string; key?: string };
  officialPublicPosts?: Array<{ text: string; created_at?: string }>;
  excludeHandle?: string;
};

export type CreatorSeedReasoningResult = {
  seeds: ConcreteSeed[];
  attempted: boolean;
  succeeded: boolean;
  error: string | null;
  requested: number;
  returned: number;
  raw_returned: number;
  reject_reasons: Record<string, number>;
  version: string;
  used_creator_dna: false;
  used_dimension_registry_as_seed_body: false;
};

function clean(v: unknown, max = 140): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
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

function messageText(body: any): string {
  const msg = body?.choices?.[0]?.message;
  if (!msg) return "";
  const c = msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c.map((p: any) => String(p?.text || p?.content || "")).join("");
  }
  if (c && typeof c === "object") return JSON.stringify(c);
  return String(msg.reasoning_content || "");
}

function responsesText(body: any): string {
  const direct = typeof body?.output_text === "string" ? body.output_text : "";
  if (direct.trim().length >= 4) return direct;
  const chunks: string[] = [];
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    if (typeof item?.text === "string") chunks.push(item.text);
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === "string") chunks.push(part.text);
    }
  }
  if (chunks.join("").trim()) return chunks.join("\n");
  return messageText(body);
}

function seedListFromParsed(parsed: any): any[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.seeds)) return parsed.seeds;
  if (Array.isArray(parsed.directions)) return parsed.directions;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.data)) return parsed.data;
  return [];
}

type NormalizeSeedResult = { seed: ConcreteSeed | null; reason?: string };

function normalizeSeedDetailed(x: any, i: number): NormalizeSeedResult {
  const situation = clean(x?.situation || x?.concrete_subject, 100);
  if (!isUsableKeywordSubject(situation)) return { seed: null, reason: "WEAK_SUBJECT" };
  if (isPublicSeedAdOrBait(situation)) return { seed: null, reason: "AD_OR_BAIT" };
  // Reject invented lived-experience claims at seed level
  if (/어제\s*내가|오늘\s*직접|방금\s*테스트했/i.test(situation)) {
    return { seed: null, reason: "INVENTED_LIVED_CLAIM" };
  }
  if (/관찰·판단 축|차원 기반 신규 각도/.test(situation)) {
    return { seed: null, reason: "ENGINE_LABEL_BODY" };
  }
  if (isFrozenHumorClone(situation)) return { seed: null, reason: "FROZEN_CLONE" };
  if (isSlotTypeLabel(situation)) return { seed: null, reason: "SLOT_LABEL_BODY" };
  if (/^(RETURN|BRIDGE|REACH)$/i.test(situation)) {
    return { seed: null, reason: "ROLE_LABEL_BODY" };
  }
  if (/사회적 증명|인지 부조화|호기심 공백|단순 노출 효과|감정 전염/.test(situation + " " + clean(x?.observation_or_feeling || x?.point_or_tension, 80))) {
    return { seed: null, reason: "THEORY_LABEL_BODY" };
  }
  const cluster = clean(x?.cluster, 40) || "OBSERVATION";
  const dimension = clean(x?.dimension, 60) || "PUBLIC_SCENE";
  const observation = clean(x?.observation_or_feeling || x?.point_or_tension, 140);
  const sourceHint = clean(x?.source_hint || x?.viral_hook, 120);
  if (hasUnseededDrivingBoltOn(situation, observation + " " + sourceHint)) {
    return { seed: null, reason: "UNSEEDED_DRIVING_BOLT_ON" };
  }
  const sourceId = clean(x?.source_id || (Array.isArray(x?.evidence_source_ids) ? x.evidence_source_ids[0] : ""), 40);
  const angle = clean(x?.idea_angle_family, 80) || `${cluster}|${dimension}|${i + 1}`;
  return { seed: {
    seed_id: `creator-reason-${i + 1}`,
    cluster,
    dimension,
    concrete_subject: situation,
    subject_signature: subjectSignature(situation),
    point_or_tension: observation || "관찰 한 줄",
    topic: cluster,
    subtopic: dimension,
    primary_source: "PUBLIC_X",
    supporting_sources: ["PUBLIC_X_SEARCH"],
    evidence_source_ids: sourceId ? [sourceId] : [],
    creator_evidence_available: false,
    experience_required: false,
    source_type: "PUBLIC_X",
    owner: "OTHER",
    seed_source: "PUBLIC_X",
    viral: true,
    found_form: String(x?.found_form || "").toUpperCase() === "EXPERIENTIAL" || /내가|어제|직접 해/.test(situation)
      ? "EXPERIENTIAL"
      : "OTHER",
    viral_hook: sourceHint,
    claim_types: ["OBSERVATION"],
    inference_type: "PUBLIC_SCENE_COLLECTED",
    grounding_status: "GROUNDED",
    grounding_reasons: ["DIRECTION_SEED_NO_FINISHED_PROSE", "NO_INVENTED_LIVED_EXPERIENCE"],
    idea_angle_family: angle,
    verified_locations: [],
    verified_entities: [],
    relationship_evidence_ids: [],
    xai_would_have_been_required: false,
    allowed_facts: [],
    factual_anchors: [],
    do_not_invent: [
      "current_news_fact_without_source",
      "creator_lived_experience",
      "manual_creator_post_wording",
      "specific_date_price_statistic_without_evidence",
    ],
    experience_facts: [],
    static_facts: [],
    current_facts: [],
    creator_opinion: [],
    status: "ELIGIBLE",
    source_role: "SEED_SOURCE",
  } as ConcreteSeed };
}

/**
 * Infer weekly direction seeds as @Seung4680 would hold them — not registry templates.
 */
export async function reasonCreatorSeeds(
  args: CreatorSeedReasoningInput,
): Promise<CreatorSeedReasoningResult> {
  const requested = Math.max(0, Math.min(64, Math.ceil(args.needed)));
  const base: CreatorSeedReasoningResult = {
    seeds: [],
    attempted: false,
    succeeded: false,
    error: null,
    requested,
    returned: 0,
    raw_returned: 0,
    reject_reasons: {},
    version: CREATOR_SEED_REASONING_VERSION,
    used_creator_dna: false,
    used_dimension_registry_as_seed_body: false,
  };
  if (!requested) return base;
  if (!args.xaiKey) return { ...base, error: "missing_xai_key" };

  const existingAbstract = (args.existing || []).slice(0, 30).map((s) => ({
    cluster: clean((s as any).cluster, 32),
    subject: clean((s as any).concrete_subject || (s as any).subject_signature, 80),
  }));
  const recent = (args.recentPublishedAngles || [])
    .map((t) => clean(t, 120))
    .filter((t) => t.length >= 12)
    .slice(0, 24);
  const viral = (args.viralCandidates || [])
    .map((v) => ({
      text: clean(v.text, 140),
      engagement_hint: clean(v.engagement_hint, 40),
    }))
    .filter((v) => v.text.length >= 12 && !isKoreaOnlySituation(v.text))
    .slice(0, 12);
  const intent = clean(args.explicitCreatorIntent, 180);

  const compact = !!args.compactRetry;
  const collectRule =
    `Collect from public Korean X in the last 14 days. Default keep: replies >= ${PUBLIC_SEED_MIN_REPLIES}. Do not use likes, reposts, or bookmarks as a keep gate. If that pool is short, supplement impressions >= ${PUBLIC_SEED_SUPPLEMENT_IMPRESSIONS} only. Extract one scene + one observation_or_feeling + optional source_hint + source_id. Do not judge RETURN/BRIDGE/REACH or editorial type.`;
  const system = compact
    ? [
      "You collect public X seed material for @Seung4680. Not a strategist. Not a writer.",
      seedCollectorBounds(),
      collectRule,
      "Return DIRECTION seeds only — never finished posts, never example prose.",
      "Do NOT invent lived experiences. Do NOT copy already_held or recent_published.",
      "Do not fill from an interest list. Tesla/FSD only if already in the found post. Do not bolt charging/Uber/generic driving onto another scene.",
      "Thin evidence is expected. Still return requested_seed_count seeds. Empty seeds array is a failure.",
      "Output strict JSON with a seeds array. Each seed: situation, observation_or_feeling, source_hint, source_id. owner OTHER. No scores, rankings, strategy, selection, allocation, or prose outside JSON.",
    ].join("\n")
    : [
    "You collect public X seed material for @Seung4680. Not a strategist. Not a writer.",
    seedCandidatePhilosophyBlock(),
    seedCollectorBounds(),
    collectRule,
    "Return seed DIRECTIONS only — never finished posts, never example prose paragraphs. Never store raw chain-of-thought.",
    "Do NOT invent lived experiences, drives, tests, prices, dates, or private events.",
    "Do NOT copy DIMENSION labels as the seed body.",
    "situation is one scene. observation_or_feeling is one observation. Distinct from every other seed this week. If FSD/driving/parking/intersection is overweight, drop extras.",
    "observation_or_feeling / point_or_tension is an optional angle, not a required snag. Do not invent conflict. Do not invent lived experience.",
    "Do not copy already_held_seeds or recent_published_angles.",
    "Do not score Creator fit, Audience fit, performance potential, strategic relevance, or selection priority. Do not rank candidates.",
    "planner_exploration_direction is a field bound only. It does not authorize selection, allocation, or type labels.",
    "If a found post is written as lived experience, set found_form EXPERIENTIAL and situation as a third-person circulating scene, not 내가/어제 내.",
    "Do not search or emit the operator's own posts.",
    "Lived evidence seeds are not your job in this call.",
    "Output strict JSON with a seeds array. Each seed: situation, observation_or_feeling, source_hint, source_id, found_form. owner is always OTHER. No scores, rankings, strategy, selection, allocation, growth_role, editorial_mode, or prose outside JSON.",
  ].join("\n");

  const user = compact
    ? JSON.stringify({
      requested_seed_count: requested,
      already_held_seeds: existingAbstract,
      recent_published_angles_avoid_repeat: recent,
      planner_exploration_direction: clean(args.explorationDirection, 240) || null,
      weekly_goal_note:
        "Collect situation + observation only. No frozen keyword list. No last-week clones. No invented experience. No role labels.",
    })
    : JSON.stringify({
    requested_seed_count: requested,
    this_run_note_overlay_only: intent || null,
    planner_exploration_direction: clean(args.explorationDirection, 240) || null,
    already_held_seeds: existingAbstract,
    recent_published_angles_avoid_repeat: recent,
    public_search_window: args.searchWindow || null,
    engagement_gate: {
      replies_or_more: PUBLIC_SEED_MIN_REPLIES,
      impressions_supplement_or_more: PUBLIC_SEED_SUPPLEMENT_IMPRESSIONS,
      likes: "not a keep gate",
      reposts: "not a keep gate",
      bookmarks: "not a keep gate",
    },
    official_public_posts: (args.officialPublicPosts || []).slice(0, 40).map((p) => ({
      text: clean(p.text, 140),
      created_at: p.created_at || null,
      id: clean((p as any).id, 24) || null,
      likes: Number((p as any).likes) || 0,
      replies: Number((p as any).replies) || 0,
      impressions: Number((p as any).impressions) || 0,
    })),
    weekly_goal_note:
      "Return requested_seed_count distinct PUBLIC X scene/observation candidates. owner OTHER. No invented creator experience. No Tesla/FSD unless in the found post. No charging/Uber bolt-on.",
    requirement:
      "No finished posts. No invented experience. No Return/Bridge/Reach labels. No interest-list fill.",
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 40000);
    const window = args.searchWindow;
    const exclude = clean(args.excludeHandle, 40) || "Seung4680";
    const xSearchTool = {
      type: "x_search",
      excluded_x_handles: [exclude],
      ...(window?.from ? { from_date: window.from } : {}),
      ...(window?.to ? { to_date: window.to } : {}),
    };
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${args.xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model || "grok-4.6",
        temperature: 0.85,
        max_output_tokens: compact ? 4096 : 8192,
        reasoning_effort: "low",
        instructions: system,
        input: [{ role: "user", content: user }],
        ...(compact ? {} : { tools: [xSearchTool] }),
      }),
    });
    clearTimeout(timer);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ...base,
        attempted: true,
        error: clean(body?.error?.message || `xai_http_${res.status}`, 180),
      };
    }
    const content = responsesText(body) || messageText(body);
    const parsed = extractJson(content);
    const rawList = seedListFromParsed(parsed);
    const seeds: ConcreteSeed[] = [];
    const seen = new Set<string>();
    const reject_reasons: Record<string, number> = {};
    const reject = (reason: string) => {
      reject_reasons[reason] = (reject_reasons[reason] || 0) + 1;
    };
    for (let i = 0; i < rawList.length; i++) {
      const normalized = normalizeSeedDetailed(rawList[i], seeds.length);
      const n = normalized.seed;
      if (!n) {
        reject(normalized.reason || "NORMALIZE_REJECT");
        continue;
      }
      if (/어제\s*내|내가\s*직접/.test(n.concrete_subject)) {
        reject("SELF_INHABIT_ON_PUBLIC");
        continue;
      }
      if (isKoreaOnlySituation(n.concrete_subject)) {
        reject("KOREA_ONLY_FABRICATION");
        continue;
      }
      n.cluster = inferPersonalCluster(n.concrete_subject, n.cluster);
      const personal = isPersonalInterestSubject(n.concrete_subject, n.cluster);
      if (!personal) {
        n.cluster = massSectorFromText(n.concrete_subject);
      }
      const sig = n.subject_signature || subjectSignature(n.concrete_subject);
      if (seen.has(sig)) {
        reject("BATCH_DUPLICATE");
        continue;
      }
      seen.add(sig);
      seeds.push(n);
      if (seeds.length >= requested) break;
    }
    const diversified = deferOverweightDrivingFamily(seeds);
    const finish = clean(body?.choices?.[0]?.finish_reason, 24);
    return {
      ...base,
      attempted: true,
      succeeded: diversified.length > 0,
      seeds: diversified,
      returned: diversified.length,
      raw_returned: rawList.length,
      reject_reasons,
      error: diversified.length
        ? null
        : clean(
          `zero_usable raw=${rawList.length} finish=${finish || "none"} preview=${content.slice(0, 80)}`,
          180,
        ),
    };
  } catch (e: any) {
    return {
      ...base,
      attempted: true,
      error: e?.name === "AbortError" ? "xai_timeout" : clean(e?.message || "creator_seed_reason_exception", 180),
    };
  }
}
