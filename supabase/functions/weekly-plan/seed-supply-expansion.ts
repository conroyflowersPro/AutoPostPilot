import { DIMENSION_REGISTRY, subjectSignature, type ConcreteSeed } from "./seed-engine.ts";

export const SEED_SUPPLY_HOTFIX_VERSION = "seed_supply_hotfix_v1";

export type XaiSeedExpansionResult = {
  seeds: ConcreteSeed[];
  attempted: boolean;
  succeeded: boolean;
  error: string | null;
  requested: number;
  returned: number;
};

function clean(v: unknown, max = 140): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function extractJson(raw: string): any {
  const txt = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(txt); } catch {}
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try { return JSON.parse(txt.slice(a, b + 1)); } catch {}
  }
  return null;
}

function normalizeSeed(x: any, i: number): ConcreteSeed | null {
  const subject = clean(x?.concrete_subject, 100);
  if (subject.length < 8) return null;
  const cluster = clean(x?.cluster, 40) || "EXPLORATION";
  const dimension = clean(x?.dimension, 60) || "XAI_EXPANSION";
  const angle = clean(x?.idea_angle_family, 80) || `${cluster}|${dimension}|${i + 1}`;
  return {
    seed_id: `xai-supply-${i + 1}`,
    cluster,
    dimension,
    concrete_subject: subject,
    subject_signature: subjectSignature(subject),
    point_or_tension: clean(x?.point_or_tension, 140) || "현재 소재에서 독립적인 관찰·판단 각도 탐색",
    primary_source: "XAI_SEED_EXPANSION",
    supporting_sources: ["XAI_SEED_EXPANSION", "DIMENSION_REGISTRY"],
    evidence_source_ids: [],
    creator_evidence_available: false,
    experience_required: false,
    source_type: "XAI_SEED_EXPANSION",
    claim_types: ["OBSERVATION"],
    inference_type: "XAI_ABSTRACT_REASONED",
    grounding_status: "GROUNDED",
    grounding_reasons: ["ABSTRACT_SEED_NO_CURRENT_FACT_CLAIM"],
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
  } as ConcreteSeed;
}

/**
 * Paid xAI expansion is only called from an explicit user-triggered weekly generation action.
 * It receives no raw manual-post prose and returns seed concepts, never finished post text.
 */
export async function expandSeedSupplyWithXai(args: {
  xaiKey: string;
  needed: number;
  existing: ConcreteSeed[];
  explicitCreatorIntent?: string;
  model?: string;
  timeoutMs?: number;
}): Promise<XaiSeedExpansionResult> {
  const requested = Math.max(0, Math.min(64, Math.ceil(args.needed)));
  if (!requested || !args.xaiKey) {
    return { seeds: [], attempted: false, succeeded: false, error: args.xaiKey ? null : "missing_xai_key", requested, returned: 0 };
  }

  const existingAbstract = args.existing.slice(0, 24).map((s) => ({
    cluster: clean((s as any).cluster, 32),
    dimension: clean((s as any).dimension, 48),
    subject_signature: clean((s as any).subject_signature || (s as any).concrete_subject, 80),
    idea_angle_family: clean((s as any).idea_angle_family, 80),
  }));
  const dimensions = DIMENSION_REGISTRY.map((d) => ({ cluster: d.cluster, dimension: d.dimension }));
  const intent = clean(args.explicitCreatorIntent, 180);

  const system = [
    "You are a seed-supply reasoner for a Korean X account planning system.",
    "Return seed CONCEPTS only, never finished posts or example prose.",
    "Each seed must be independently useful and materially different in thought direction.",
    "Do not map a topic to a fixed conclusion. Explore different incentives, tradeoffs, user impact, operational reality, decision criteria, second-order effects, observation, comparison, or future consequence only when they genuinely fit.",
    "Do not invent current news, prices, dates, statistics, private experiences, locations, or claims of what the creator personally did.",
    "Avoid generic AI advice and generic inspirational themes.",
    "No criticism/attack-focused seeds.",
    "No relationship-specific callbacks or personal relationship management.",
    "Use Korean for concrete_subject and point_or_tension.",
    "Output strict JSON: {\"seeds\":[{\"cluster\":\"...\",\"dimension\":\"...\",\"concrete_subject\":\"...\",\"point_or_tension\":\"...\",\"idea_angle_family\":\"...\"}]}",
  ].join("\n");

  const user = JSON.stringify({
    requested_seed_count: requested,
    creator_intent_if_explicit: intent || null,
    available_dimensions: dimensions,
    already_used_abstract_signatures: existingAbstract,
    requirement: "Create enough distinct seed concepts to fill the requested count. Prefer adjacent expansion over random unrelated topics. Do not repeat the same conclusion with different nouns.",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 30000);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.xaiKey}` },
      body: JSON.stringify({
        model: args.model || "grok-4-latest",
        temperature: 0.85,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { seeds: [], attempted: true, succeeded: false, error: clean(body?.error?.message || `xai_http_${res.status}`, 180), requested, returned: 0 };
    }
    const raw = body?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(raw);
    const rows = Array.isArray(parsed?.seeds) ? parsed.seeds : [];
    const used = new Set(args.existing.map((s: any) => subjectSignature(String(s?.concrete_subject || ""))));
    const out: ConcreteSeed[] = [];
    for (let i = 0; i < rows.length && out.length < requested; i++) {
      const seed = normalizeSeed(rows[i], i);
      if (!seed) continue;
      const sig = subjectSignature(seed.concrete_subject);
      if (!sig || used.has(sig)) continue;
      used.add(sig);
      seed.seed_id = `xai-supply-${out.length + 1}`;
      out.push(seed);
    }
    return { seeds: out, attempted: true, succeeded: out.length > 0, error: out.length ? null : "xai_seed_json_empty", requested, returned: out.length };
  } catch (e: any) {
    return { seeds: [], attempted: true, succeeded: false, error: clean(e?.message || "xai_seed_expand_exception", 180), requested, returned: 0 };
  } finally {
    clearTimeout(timer);
  }
}
