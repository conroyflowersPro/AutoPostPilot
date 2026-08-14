/**
 * Creator-driven Seed Reasoning.
 * Will = Creator DNA + engine rules (not a generate-box sentence).
 * Does NOT emit DIMENSION_REGISTRY as production seed bodies.
 * Output = direction seeds only (no finished post prose).
 */
import { subjectSignature, type ConcreteSeed } from "./seed-engine.ts";
import { creatorDnaBlock, engineRulesAsWill, performanceDnaBlock } from "./engine-dna.ts";

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
  model?: string;
  timeoutMs?: number;
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

/** Soft performance patterns — advisory only, never seed clone */
function defaultPerformanceHints(): string[] {
  return [
    "Practical investigation + real media → bookmarks/views candidate",
    "Honest incident / observation with low entry barrier → replies candidate",
    "Everyday wording (e.g. 돈 not 자산) can raise attention without changing meaning",
    "Do NOT reuse a past winning seed subject; transfer flow/entry/wording quality only",
  ];
}

function interestDomainGate(text: string): boolean {
  const t = text.toLowerCase();
  // Creator interest domains — viral must pass this filter
  return (
    /tesla|fsd|cyber|robotaxi|로보|오토파일|자율|충전|수퍼차|lafc|축구|경기|직관|게임|그록|grok|ai|도지|doge|미국|한국|운전|차\b|모델\s*[3sy]|플래드|plaid/i.test(
      t,
    ) || t.length < 8
  );
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
    .filter((v) => v.text.length >= 12 && interestDomainGate(v.text))
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
    "Each concrete_subject must name a specific observable tension or situation, distinct from every other seed this week.",
    "Mix follows observed cluster_weights. Tesla may dominate IF that is the data — still every Tesla seed must be a NEW angle, not the same axis recycled.",
    "If USER_DIRECT shows gaming, LAFC, daily, or AI, include those clusters in proportion. Do not zero them out to fill Tesla templates.",
    "Will is Creator DNA + engine rules. Do not wait for a typed restatement. this_run_note is overlay only.",
    "registry_interest_hints are HINTS of historically observed interests — never emit them as seed bodies.",
    "Viral inputs are optional sparks only if they fit Creator interest domains; never restate viral claims as Seung's experience.",
    "Performance hints are PATTERN transfer only — never 'reuse last week's winning seed'.",
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
    registry_interest_hints_not_seed_bodies: (args.registryInterestHints || []).slice(0, 12),
    this_run_note_overlay_only: intent || null,
    recent_published_angles_avoid_repeat: recent,
    already_held_seeds: existingAbstract,
    interest_filtered_viral_sparks: viral.length ? viral : null,
    performance_pattern_hints_not_seed_clones: perf,
    weekly_goal_note:
      "Fill the inferred quota. Distinct directions from DNA + engine + learned data. No frozen axes. Return requested_seed_count seeds.",
    requirement:
      "Produce distinct inferred direction seeds. No finished posts. No invented experience. No template rotation. No registry-label bodies.",
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
        temperature: 0.85,
        max_tokens: 2200,
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
    const content = body?.choices?.[0]?.message?.content || body?.choices?.[0]?.message || "";
    const parsed = extractJson(typeof content === "string" ? content : JSON.stringify(content));
    const rawList = Array.isArray(parsed?.seeds) ? parsed.seeds : [];
    const seeds: ConcreteSeed[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < rawList.length; i++) {
      const n = normalizeSeed(rawList[i], seeds.length);
      if (!n) continue;
      const sig = n.subject_signature || subjectSignature(n.concrete_subject);
      if (seen.has(sig)) continue;
      seen.add(sig);
      seeds.push(n);
      if (seeds.length >= requested) break;
    }
    return {
      ...base,
      attempted: true,
      succeeded: seeds.length > 0,
      seeds,
      returned: seeds.length,
      error: seeds.length ? null : "zero_usable_seeds_after_normalize",
    };
  } catch (e: any) {
    return {
      ...base,
      attempted: true,
      error: e?.name === "AbortError" ? "xai_timeout" : clean(e?.message || "creator_seed_reason_exception", 180),
    };
  }
}
