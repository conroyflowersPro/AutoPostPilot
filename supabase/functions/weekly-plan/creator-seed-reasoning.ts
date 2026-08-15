/**
 * Creator-driven Seed Reasoning.
 * Will = Creator DNA + engine rules (not a generate-box sentence).
 * Does NOT emit DIMENSION_REGISTRY as production seed bodies.
 * Output = direction seeds only (no finished post prose).
 */
import { subjectSignature, type ConcreteSeed } from "./seed-engine.ts";
import { creatorDnaBlock, engineRulesAsWill, performanceDnaBlock } from "./engine-dna.ts";
import { adjacentDomainGate, adjacentRingPromptLines } from "./adjacent-expansion.ts";
import { humorRingPromptLines } from "./humor-fill.ts";
import {
  isForbiddenDefaultSubject,
  isPersonalInterestSubject,
  massSectorFromText,
  MASS_PER_DAY_MAX,
} from "./seed-scope.ts";
import { QUOTA_DAYS } from "./quota-inference.ts";

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
  /** Soft pattern lines only — never "reuse this seed" */
  performancePatternHints?: string[];
  /** Observed USER_DIRECT cluster counts — mix follows data, not 8 frozen axes */
  clusterInterestWeights?: Array<{ cluster: string; n: number }>;
  /** Registry labels as HINTS only — never copy as concrete_subject */
  registryInterestHints?: Array<{ cluster: string; dimension: string }>;
  userDirectN?: number;
  learning?: {
    stage?: string;
    note_ko?: string;
    seed_rule?: string;
    validated_performance_patterns?: number;
  };
  model?: string;
  timeoutMs?: number;
  /** Mass public sectors (legacy hole fill). Prefer humorRing. */
  adjacentRing?: boolean;
  /** Personal-interest observational humor to fill quota holes. */
  humorRing?: boolean;
};

export type CreatorSeedReasoningResult = {
  seeds: ConcreteSeed[];
  attempted: boolean;
  succeeded: boolean;
  error: string | null;
  requested: number;
  returned: number;
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

/** Soft performance patterns — advisory only, never seed clone */
function defaultPerformanceHints(): string[] {
  return [
    "Practical investigation + real media → bookmarks/views candidate",
    "Honest incident / observation with low entry barrier (wording AND wording range) → readers, not a Tesla club",
    "Lived tension + how it resolved can be informative; do not hard-assert — leave judgment so readers can reply",
    "Everyday wording (e.g. 돈 not 자산) can raise attention without changing meaning",
    "Do not write only keep-worthy posts; mix/diversity is how bookmarks are sought",
    "Do NOT reuse a past winning seed subject; transfer flow/entry/wording quality only",
  ];
}

function interestDomainGate(text: string): boolean {
  const t = String(text || "");
  if (isForbiddenDefaultSubject(t)) return false;
  if (adjacentDomainGate(t)) return true;
  if (isPersonalInterestSubject(t)) return true;
  return t.length < 8;
}

function normalizeSeed(x: any, i: number): ConcreteSeed | null {
  const subject = clean(x?.concrete_subject, 100);
  if (subject.length < 8) return null;
  // Reject invented lived-experience claims at seed level
  if (/어제\s*내가|오늘\s*직접|방금\s*테스트했/i.test(subject)) return null;
  if (/관찰·판단 축|차원 기반 신규 각도/.test(subject)) return null;
  const cluster = clean(x?.cluster, 40) || "OBSERVATION";
  const dimension = clean(x?.dimension, 60) || "CREATOR_REASONED";
  const angle = clean(x?.idea_angle_family, 80) || `${cluster}|${dimension}|${i + 1}`;
  const entry = clean(x?.entry_direction, 80);
  const wording = clean(x?.wording_note, 80);
  const tension = clean(x?.point_or_tension, 140) ||
    (entry ? `진입: ${entry}` : "관찰·판단 각도");
  return {
    seed_id: `creator-reason-${i + 1}`,
    cluster,
    dimension,
    concrete_subject: subject,
    subject_signature: subjectSignature(subject),
    point_or_tension: tension,
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
  } as ConcreteSeed;
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
    .filter((v) => v.text.length >= 12 && (args.humorRing || !args.adjacentRing ? interestDomainGate(v.text) : adjacentDomainGate(v.text)))
    .slice(0, 12);
  const perf = (args.performancePatternHints?.length
    ? args.performancePatternHints
    : defaultPerformanceHints()).map((p) => clean(p, 120)).slice(0, 8);
  const intent = clean(args.explicitCreatorIntent, 180);

  const system = [
    "You are the seed-reasoning layer for X account @Seung4680 (Korean track).",
    "Return seed DIRECTIONS only — never finished posts, never example prose paragraphs.",
    "Each seed must be something @Seung4680 would hold — inferred from Creator DNA + engine rules + learned USER_DIRECT data.",
    "Do NOT invent lived experiences, drives, tests, prices, dates, or private events.",
    "Do NOT copy DIMENSION labels as the seed body. Do NOT rotate a fixed 8-axis template list.",
    "Forbidden concrete_subject form: 'FSD SUPERVISION 관찰·판단 축' or any CLUSTER DIMENSION label dump.",
    "Each concrete_subject names a writable situation OR a short keyword the writer may infer from. Distinct from every other seed this week.",
    "A short keyword subject is valid. Infer a public-agreeable situation through Creator DNA vision. Never emit hardcoded example seed bodies or example post prose.",
    "point_or_tension is an optional angle, not a required snag. Do not invent conflict. Do not invent lived experience.",
    "INFORMATIVE seeds stay in public scope for readers, not a Tesla club. Low entry barrier is wording AND wording range. Prefer words general readers and X catch, without distorting the claim. Avoid expert-only site names when a broader accurate phrase exists.",
    "Thin or missing learned evidence is expected at cold start. Still return requested_seed_count seeds. Do not return an empty seeds array because evidence is incomplete.",
    "NEW READERS FIRST via one mass-public slot per day. Personal-interest originals fill the rest. Tesla/Elon/Robotaxi-news are not the default seed subject.",
    "Creator lives in California. Seeds are Korean words about US/CA daily life. FORBIDDEN invented subjects: 이중주차, 관리사무소, 주민센터, 배민, 따릉이, 전세/청약, Korea subway/apartment-complex civic life.",
    "At most 1 mass-public daily-life seed per day of quota. Remaining seeds MUST be personal-interest (FSD/Cybertruck/LAFC/gaming/lived Tesla product). Do not invent lived episodes.",
    "If this batch asks for 6 seeds, return at most 1 mass + 5 personal. Do not return a mass-only list.",
    "Do not emit Elon/Musk, Tesla ticker, or Robotaxi news as concrete_subject.",
    "cluster_weights inform the personal mix. Mass public is the 1/day entry slot, not the week's center.",
    "Will is Creator DNA + engine rules. Do not wait for a typed restatement. this_run_note is overlay only.",
    "registry_interest_hints are HINTS of historically observed interests — never emit them as seed bodies.",
    "Viral inputs are optional sparks only if they fit Creator interest domains; never restate viral claims as Seung's experience.",
    "Performance hints are PATTERN transfer only — never 'reuse last week's winning seed'.",
    "Lived evidence seeds may be CITE+RELATED follow-ups (e.g. night FSD pedestrian wait). Never clone the same content.",
    ...(args.humorRing ? humorRingPromptLines() : args.adjacentRing ? adjacentRingPromptLines() : []),
    "Do NOT name specific cities or venues in concrete_subject unless that label already appears in learned angle labels.",
    'Output strict JSON: {"seeds":[{"cluster":"...","dimension":"...","concrete_subject":"...","point_or_tension":"...","idea_angle_family":"...","entry_direction":"...","wording_note":"..."}]}',
  ].join("\n");

  const user = JSON.stringify({
    requested_seed_count: requested,
    creator_dna: creatorDnaBlock(),
    engine_rules_are_the_will: engineRulesAsWill(),
    performance_dna: performanceDnaBlock(),
    user_direct_n: args.userDirectN ?? null,
    cluster_weights_from_user_direct: args.clusterInterestWeights?.length
      ? args.clusterInterestWeights
      : null,
    learning: args.learning
      ? {
          stage: args.learning.stage || null,
          note_ko: args.learning.note_ko || null,
          seed_rule: args.learning.seed_rule || null,
          validated_performance_patterns: args.learning.validated_performance_patterns ?? 0,
        }
      : null,
    registry_interest_hints_not_seed_bodies: (args.registryInterestHints || []).slice(0, 12),
    this_run_note_overlay_only: intent || null,
    recent_published_angles_avoid_repeat: recent,
    already_held_seeds: existingAbstract,
    interest_filtered_viral_sparks: viral.length ? viral : null,
    performance_pattern_hints_not_seed_clones: perf,
    weekly_goal_note: args.humorRing
      ? "Fill quota holes with personal-interest CASUAL/OPINION humor from Creator DNA. No invented lived experience. Return requested_seed_count seeds."
      : args.adjacentRing
      ? "Fill leftover mass-public slots only (max 1/day). Rest of the hole fill is personal. Return requested_seed_count seeds."
      : "Fill the inferred 3-day quota. Personal-interest originals are the main mix. At most 1 mass-public daily-life seed per day. No invented experience. Return requested_seed_count seeds.",
    requirement:
      "Produce distinct inferred direction seeds. No finished posts. No invented experience. No template rotation. No registry-label bodies.",
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
        max_tokens: 8192,
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
    const maxMass = args.humorRing
      ? 0
      : args.adjacentRing
        ? Math.max(1, MASS_PER_DAY_MAX * QUOTA_DAYS)
        : Math.max(1, Math.min(MASS_PER_DAY_MAX * QUOTA_DAYS, Math.ceil(requested / 4)));
    let massN = 0;
    for (let i = 0; i < rawList.length; i++) {
      const n = normalizeSeed(rawList[i], seeds.length);
      if (!n) continue;
      if (isForbiddenDefaultSubject(n.concrete_subject)) continue;
      const personal = isPersonalInterestSubject(n.concrete_subject, n.cluster);
      if (!personal) {
        if (massN >= maxMass) continue;
        massN += 1;
        n.cluster = massSectorFromText(n.concrete_subject);
      }
      const sig = n.subject_signature || subjectSignature(n.concrete_subject);
      if (seen.has(sig)) continue;
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
