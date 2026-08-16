/**
 * Creator-driven Seed Reasoning.
 * Will = Creator DNA + engine rules (not a generate-box sentence).
 * Does NOT emit DIMENSION_REGISTRY as production seed bodies.
 * Output = direction seeds only (no finished post prose).
 */
import { isUsableKeywordSubject, subjectSignature, type ConcreteSeed } from "./seed-engine.ts";
import { creatorDnaBlock } from "./engine-dna.ts";
import { seedCandidatePhilosophyBlock } from "./engine-stage-philosophy.ts";
import { isFrozenHumorClone } from "./humor-fill.ts";
import {
  buildOpenSlots,
  inferPersonalCluster,
  isKoreaOnlySituation,
  isPersonalInterestSubject,
  isSlotTypeLabel,
  massSectorFromText,
  type OpenSeedSlot,
} from "./seed-scope.ts";

export const CREATOR_SEED_REASONING_VERSION = "creator_seed_reasoning_v2_inferred";

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
  used_creator_dna: true;
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
  const subject = clean(x?.concrete_subject, 100);
  if (!isUsableKeywordSubject(subject)) return { seed: null, reason: "WEAK_SUBJECT" };
  // Reject invented lived-experience claims at seed level
  if (/어제\s*내가|오늘\s*직접|방금\s*테스트했/i.test(subject)) {
    return { seed: null, reason: "INVENTED_LIVED_CLAIM" };
  }
  if (/관찰·판단 축|차원 기반 신규 각도/.test(subject)) {
    return { seed: null, reason: "ENGINE_LABEL_BODY" };
  }
  if (isFrozenHumorClone(subject)) return { seed: null, reason: "FROZEN_CLONE" };
  if (isSlotTypeLabel(subject)) return { seed: null, reason: "SLOT_LABEL_BODY" };
  const cluster = clean(x?.cluster, 40) || "OBSERVATION";
  const dimension = clean(x?.dimension, 60) || "CREATOR_REASONED";
  const angle = clean(x?.idea_angle_family, 80) || `${cluster}|${dimension}|${i + 1}`;
  const entry = clean(x?.entry_direction, 80);
  const wording = clean(x?.wording_note, 80);
  const tension = clean(x?.point_or_tension, 140) ||
    (entry ? `진입: ${entry}` : "관찰·판단 각도");
  return { seed: {
    seed_id: `creator-reason-${i + 1}`,
    cluster,
    dimension,
    concrete_subject: subject,
    subject_signature: subjectSignature(subject),
    point_or_tension: tension,
    topic: clean(x?.topic, 60) || cluster,
    subtopic: clean(x?.subtopic, 80) || dimension,
    primary_source: "CREATOR_SEED_REASONING",
    supporting_sources: ["CREATOR_DNA", "RECENT_PUBLISHED", "XAI_REASONING"].concat(
      wording ? ["WORDING_INTENT"] : [],
    ),
    evidence_source_ids: [],
    creator_evidence_available: false,
    experience_required: false,
    source_type: "CREATOR_SEED_REASONING",
    claim_types: ["OBSERVATION"],
    inference_type: "CREATOR_REASONED_DIRECTION",
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
    ...(entry ? { entry_direction: entry } : {}),
    ...(wording ? { wording_note: wording } : {}),
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
    used_creator_dna: true,
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
  const openSlots = (args.openSlots?.length
    ? args.openSlots
    : buildOpenSlots({
      needed: requested,
      existing: args.existing,
    })).slice(0, requested);
  const slotFillRule =
    "open_slots are candidate-discovery cells, not final publish slots. Fill each concrete_subject by exploring from Creator DNA bounds. Leave no cell empty. Do not copy slot_kind, cluster_bound, or cluster enum names into concrete_subject. Do not write example sentences or sample phrases. Infer a NEW situation or usable short keyword per cell.";
  const system = compact
    ? [
      "You infer X direction seeds for @Seung4680 (Korean track, California life).",
      "Return DIRECTION seeds only — never finished posts, never example prose.",
      "Infer NEW situations from Creator DNA interest domains this run. Mix the domains. Do not rotate a canned list.",
      "Do NOT invent lived experiences, drives, tests, prices, dates, or private events.",
      "Do NOT copy DIMENSION labels. Do NOT emit a canned keyword list. Do not copy already_held or recent_published.",
      slotFillRule,
      "Each concrete_subject is a distinct writable situation or a usable short Korean/English keyword, different from already_held and recent_published.",
      "Explore Creator interests and adjacent public situations. Final selection—not candidate generation—applies the daily public-topic mix.",
      "Thin evidence is expected. Still return requested_seed_count seeds. Empty seeds array is a failure.",
      "Output strict JSON with a seeds array. Each Seed has cluster, dimension, concrete_subject, topic, subtopic, point_or_tension, idea_angle_family, entry_direction, and wording_note. No scores, rankings, strategy, selection, allocation, or prose outside JSON.",
    ].join("\n")
    : [
    "You are the seed-reasoning layer for X account @Seung4680 (Korean track).",
    seedCandidatePhilosophyBlock(),
    "Return seed DIRECTIONS only — never finished posts, never example prose paragraphs. Never store raw chain-of-thought.",
    "Explore broadly within Creator DNA interests, adjacent areas, and plausible new expansion areas. Do not decide which candidate is strategically good; Planner owns that.",
    "Do NOT invent lived experiences, drives, tests, prices, dates, or private events.",
    "Do NOT copy DIMENSION labels as the seed body. Do NOT rotate a fixed 8-axis template list.",
    "Do not dump CLUSTER + DIMENSION labels as concrete_subject. Code drops registry-label bodies.",
    slotFillRule,
    "Each concrete_subject names a writable situation OR a short keyword the writer may infer from. Distinct from every other seed this week.",
    "A short keyword subject is a thinking material, not yet the post topic. Do not auto-promote a keyword into the published subject.",
    "point_or_tension is an optional angle, not a required snag. Do not invent conflict. Do not invent lived experience.",
    "Thin or missing learned evidence is expected at cold start. Still return requested_seed_count seeds. Do not return an empty seeds array because evidence is incomplete.",
    "Explore current interests, adjacent areas, and plausible new expansion areas without deciding strategic value.",
    "Creator lives in California. Seeds are Korean words about US/CA daily life. Do not invent Korea-only civic or housing situations the creator does not live. Code drops those.",
    "Candidate generation has no topic, domain, Editorial Mode, or personal/public quota. Do not invent lived episodes.",
    "Do not copy already_held_seeds or recent_published_angles. Do not rotate last week's subjects. Infer a NEW situation each seed.",
    "Do not score Creator fit, Audience fit, performance potential, strategic relevance, or selection priority. Do not rank candidates.",
    "this_run_note and planner_exploration_direction are exploration bounds only. They do not authorize selection or allocation.",
    "When Planner has locked the week, requested_seed_count is the Planner count plus a small week buffer. Return that many candidates. planner_slot_intents describe locked cells so exploration can cover them. They are not a per-mode production quota.",
    "When planner_exploration_direction is set, explore THAT field only. Return requested_seed_count distinct candidates in that field (a batch, never a single seed). Do not refill unrelated types or restart the whole week pool.",
    "Viral inputs are optional sparks only if they fit Creator interest domains; never restate viral claims as Seung's experience.",
    "Lived evidence seeds may be CITE+RELATED follow-ups from held episodes. Never clone the same content. Do not copy a prompt example as the new subject.",
    'Output strict JSON with a seeds array. Each Seed has cluster, dimension, concrete_subject, topic, subtopic, point_or_tension, idea_angle_family, entry_direction, and wording_note. No scores, rankings, strategy, selection, allocation, or prose outside JSON.',
  ].join("\n");

  const plannerSlots = (args.plannerSlotIntents || []).slice(0, 56).map((slot) => ({
    slot_id: clean(slot.slot_id, 40),
    day_offset: Number(slot.day_offset) || 0,
    editorial_mode: clean(slot.editorial_mode, 40),
    planner_intent: clean(slot.planner_intent, 180),
    strategic_role: clean(slot.strategic_role, 80),
  }));
  const user = compact
    ? JSON.stringify({
      requested_seed_count: requested,
      planner_requested_count: args.plannerRequestedCount || requested,
      planner_slot_intents: plannerSlots.length ? plannerSlots : null,
      open_slots: openSlots,
      creator_dna: creatorDnaBlock(),
      already_held_seeds: existingAbstract,
      recent_published_angles_avoid_repeat: recent,
      planner_exploration_direction: clean(args.explorationDirection, 240) || null,
      weekly_goal_note:
        "Fill every open_slot.concrete_subject by inference. Return requested_seed_count seeds. No frozen keyword list. No last-week clones. No invented experience. No example sentences.",
    })
    : JSON.stringify({
    requested_seed_count: requested,
    planner_requested_count: args.plannerRequestedCount || requested,
    planner_slot_intents: plannerSlots.length ? plannerSlots : null,
    open_slots: openSlots,
    creator_dna: creatorDnaBlock(),
    this_run_note_overlay_only: intent || null,
    planner_exploration_direction: clean(args.explorationDirection, 240) || null,
    recent_published_angles_avoid_repeat: recent,
    already_held_seeds: existingAbstract,
    interest_filtered_viral_sparks: viral.length ? viral : null,
    weekly_goal_note:
      "Return requested_seed_count distinct candidates for the seven-day Seed Pool. requested_seed_count comes from Planner after it locked the week. Explore broadly; do not score, select, allocate, or decide writing form. No invented experience.",
    requirement:
      "Fill typed empty cells by inference. No example sentences. No finished posts. No invented experience. No template rotation. No registry-label bodies.",
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 32000);
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${args.xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model || "grok-4.6",
        temperature: 0.85,
        max_tokens: compact ? 4096 : 8192,
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
        ...base,
        attempted: true,
        error: clean(body?.error?.message || `xai_http_${res.status}`, 180),
      };
    }
    const content = messageText(body);
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
    const finish = clean(body?.choices?.[0]?.finish_reason, 24);
    return {
      ...base,
      attempted: true,
      succeeded: seeds.length > 0,
      seeds,
      returned: seeds.length,
      raw_returned: rawList.length,
      reject_reasons,
      error: seeds.length
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
