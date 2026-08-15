/**
 * Dynamic Concrete Seed Engine v9.1.0 — Edge pack (quality gates + idea angle + mode helpers)
 * No production concrete bootstrap templates. ORDER 3 evidence-packet reasoning.
 * ORDER 3+4 FINAL HOTFIX: allowed_facts / factual_anchors propagation.
 * ORDER 0B: Manual posts never auto SEED_SOURCE.
 * DIMENSION_REGISTRY is interest HINTS only — never production seed bodies.
 */
import {
  extractEvidencePacket,
  reasonSeedSubjectFromPacket,
} from "./evidence-packet.ts";

export type SeedStatus = "NEW" | "ELIGIBLE" | "HIGH_VALUE" | "REJECTED" | "HOLD" | "FACT_CONTEXT_REQUIRED" | "NEEDS_CREATOR_CONTEXT";
export type ConcreteSeed = {
  seed_id: string;
  cluster: string;
  dimension: string;
  concrete_subject: string;
  subject_signature: string;
  primary_source?: string;
  supporting_sources?: string[];
  status?: SeedStatus;
  point_or_tension?: string;
  requested_editorial_mode?: string;
  creator_evidence_available?: boolean;
  editorial_fit?: string;
  length_mode?: string;
  experience_required?: boolean;
  evidence_source_ids?: string[];
  claim_types?: string[];
  inference_type?: string;
  grounding_status?: string;
  grounding_reasons?: string[];
  source_type?: string;
  idea_angle_family?: string;
  verified_locations?: string[];
  verified_entities?: string[];
  relationship_evidence_ids?: string[];
  xai_would_have_been_required?: boolean;
  allowed_facts?: string[];
  factual_anchors?: string[];
  do_not_invent?: string[];
  experience_facts?: string[];
  static_facts?: string[];
  current_facts?: string[];
  creator_opinion?: string[];
  source_role?: string;
  [key: string]: unknown;
};
export type EditorialMode = "INFORMATIVE" | "COMPARE" | "OPINION" | "EXPERIENCE" | "CASUAL_OBSERVATION";
export type AiSpecificity = "STRONG" | "ACCEPTABLE" | "GENERIC";
export type InformationalValue = "STRONG" | "ACCEPTABLE" | "WEAK";
export type ConceptualRepetition = "LOW" | "MEDIUM" | "HIGH";

export const WEEKLY_EDITORIAL_MODES: EditorialMode[] = [
  "INFORMATIVE", "COMPARE", "OPINION", "EXPERIENCE", "CASUAL_OBSERVATION",
];

export function createSeedIdFactory(prefix = "s") {
  let n = 0;
  return () => `${prefix}${++n}`;
}
export function isSelectableStatus(status: string | undefined): boolean {
  return status === "ELIGIBLE" || status === "HIGH_VALUE";
}
export function subjectSignature(s: string): string {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}
export function applyLocalGates(raw: any[], _recent: string[], nextId: () => string = createSeedIdFactory("s")) {
  const passed: ConcreteSeed[] = [];
  for (const r of raw || []) {
    if (!r?.concrete_subject) continue;
    const sub = String(r.concrete_subject);
    if (sub.length > 120 && /[.!?。]/.test(sub)) continue;
    passed.push({
      seed_id: nextId(),
      cluster: String(r.cluster || "OTHER"),
      dimension: String(r.dimension || "GENERAL"),
      concrete_subject: sub,
      subject_signature: subjectSignature(sub),
      primary_source: r.primary_source || "EVIDENCE_DERIVED",
      supporting_sources: r.supporting_sources || ["EVIDENCE_PACKET"],
      status: (r.status as SeedStatus) || "ELIGIBLE",
      creator_evidence_available: !!r.creator_evidence_available,
      point_or_tension: r.point_or_tension,
      requested_editorial_mode: r.requested_editorial_mode,
      experience_required: !!r.experience_required,
      evidence_source_ids: r.evidence_source_ids,
      claim_types: r.claim_types,
      inference_type: r.inference_type,
      grounding_status: r.grounding_status,
      grounding_reasons: r.grounding_reasons,
      source_type: r.source_type,
      idea_angle_family: r.idea_angle_family,
      verified_locations: r.verified_locations,
      verified_entities: r.verified_entities,
      relationship_evidence_ids: r.relationship_evidence_ids,
      xai_would_have_been_required: !!r.xai_would_have_been_required,
      allowed_facts: Array.isArray(r.allowed_facts) ? r.allowed_facts.map(String) : undefined,
      factual_anchors: Array.isArray(r.factual_anchors) ? r.factual_anchors.map(String) : undefined,
      do_not_invent: Array.isArray(r.do_not_invent) ? r.do_not_invent.map(String) : undefined,
      experience_facts: Array.isArray(r.experience_facts) ? r.experience_facts.map(String) : undefined,
      static_facts: Array.isArray(r.static_facts) ? r.static_facts.map(String) : undefined,
      current_facts: Array.isArray(r.current_facts) ? r.current_facts.map(String) : undefined,
      creator_opinion: Array.isArray(r.creator_opinion) ? r.creator_opinion.map(String) : undefined,
      source_role: r.source_role,
    });
  }
  return { passed, local_gate_rejected: 0, reject_reasons: {} };
}
export function buildLafcPrematchSeeds(): ConcreteSeed[] { return []; }
export function consolidateSemanticGroups(seeds: ConcreteSeed[]): ConcreteSeed[] { return seeds; }
export function markSameStoryWithinPool(seeds: ConcreteSeed[]): ConcreteSeed[] { return seeds; }
export function canonicalSemanticGroupKey(seed: any): string {
  return subjectSignature(`${seed?.cluster || ""}-${seed?.concrete_subject || ""}`);
}
export function extractJson(raw: string): any | null {
  try { return JSON.parse(String(raw || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); } catch { return null; }
}
/** Interest-cluster hints only. Never emit these labels as concrete_subject bodies. */
export const DIMENSION_REGISTRY: Array<{ cluster: string; dimension: string; core?: boolean }> = [
  { cluster: "FSD", dimension: "SUPERVISION", core: true },
  { cluster: "FSD", dimension: "MERGE_BEHAVIOR", core: true },
  { cluster: "CYBERTRUCK", dimension: "CHARGING", core: true },
  { cluster: "CYBERTRUCK", dimension: "OWNER_TRADEOFF", core: true },
  { cluster: "ROBOTAXI", dimension: "CURBSIDE_OPS", core: true },
  { cluster: "AI_TECH", dimension: "TOOL_LIMITS" },
  { cluster: "LAFC", dimension: "MATCHDAY" },
  { cluster: "GAMING", dimension: "SHORT_SESSION" },
];

export type ClusterWeight = { cluster: string; n: number };
export type CadenceSignal = {
  days_with_originals: number;
  avg_originals_on_active_days: number;
  originals_last_14d: number;
  window_days: number;
};
export type LearnedSeedSignals = {
  user_direct_n: number;
  cluster_weights: ClusterWeight[];
  recent_angle_labels: string[];
  registry_interest_hints: Array<{ cluster: string; dimension: string }>;
  performance_pattern_hints: string[];
  cadence: CadenceSignal;
  learning: LearningState;
};

/** Early weeks have thin evidence. That is expected — not a reason to emit 0 seeds or registry templates. */
export type LearningStage = "COLD" | "SPARSE" | "ACCUMULATING";
export type LearningState = {
  stage: LearningStage;
  user_direct_n: number;
  originals_last_14d: number;
  validated_performance_patterns: number;
  note_ko: string;
  seed_rule: string;
};

export function inferLearningState(args: {
  user_direct_n: number;
  cadence: CadenceSignal;
}): LearningState {
  const user_direct_n = Math.max(0, Number(args.user_direct_n) || 0);
  const originals_last_14d = Math.max(0, Number(args.cadence?.originals_last_14d) || 0);
  const validated_performance_patterns = 0;
  let stage: LearningStage;
  if (user_direct_n < 8 && originals_last_14d < 5) stage = "COLD";
  else if (user_direct_n >= 30 && originals_last_14d >= 20) stage = "ACCUMULATING";
  else stage = "SPARSE";
  const note_ko =
    stage === "COLD"
      ? "초기입니다. 학습 데이터가 거의 없습니다. DNA로 이번 주를 추론합니다. 쌓이면 각도가 정확해집니다."
      : stage === "SPARSE"
        ? "학습이 아직 얕습니다. DNA와 있는 원글로 추론합니다. 성과 패턴은 아직 후보입니다."
        : "원글은 쌓이는 중입니다. 성과 DNA는 아직 후보라 DNA·원글 위주로 추론합니다.";
  return {
    stage,
    user_direct_n,
    originals_last_14d,
    validated_performance_patterns,
    note_ko,
    seed_rule:
      "Thin or missing learned evidence is expected at this stage. Still return requested_seed_count direction seeds from Creator DNA + engine rules + whatever USER_DIRECT exists. Do not return an empty seeds array because evidence is incomplete. Do not invent lived episodes. Do not emit DIMENSION_REGISTRY labels as seed bodies. As USER_DIRECT and published outcomes accumulate, follow that data more closely.",
  };
}

function metricsFromMeta(meta: unknown): Record<string, number> {
  const bag = (meta && typeof meta === "object" ? meta : {}) as Record<string, unknown>;
  const pub = (bag.public_metrics || bag.publicMetrics || bag) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(pub || {})) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function rowHasReaderEntry(meta: unknown): boolean {
  const m = metricsFromMeta(meta);
  return (
    (m.reply_count || 0) >= 1 ||
    (m.retweet_count || 0) >= 1 ||
    (m.quote_count || 0) >= 1 ||
    (m.bookmark_count || 0) >= 1
  );
}

/**
 * Learning signals from USER_DIRECT activity + optional performance.
 * Never a seed list. Registry appears only as cluster hints.
 */
export function collectLearnedSeedSignals(opts: {
  publishedSubjects?: string[];
  publishedEvidence?: Array<PublishedEvidenceRow & { meta?: unknown; system_origin_class?: string }>;
  intentText?: string;
}): LearnedSeedSignals {
  const topicHits = new Map<string, number>();
  const entryHits = new Map<string, number>();
  const recent_angle_labels: string[] = [];
  const rows: Array<PublishedEvidenceRow & { meta?: unknown; system_origin_class?: string }> =
    Array.isArray(opts.publishedEvidence) && opts.publishedEvidence.length
      ? opts.publishedEvidence
      : (opts.publishedSubjects || []).map((t) => ({ text: String(t) }));

  let user_direct_n = 0;
  const dayHits = new Map<string, number>();
  let originals_last_14d = 0;
  const now = Date.now();
  const d14 = 14 * 24 * 3600 * 1000;
  for (const row of rows.slice(0, 80)) {
    const text = String(row.text || "").trim();
    if (text.length < 12) continue;
    const soc = String(row.system_origin_class || "").toUpperCase();
    if (soc && /AP_PIPELINE|APP|SYSTEM|AUTOPOST|FEDICA_AUTO|GENERATED/.test(soc)) continue;
    const pt = String(row.post_type || "").toUpperCase();
    if (pt.includes("REPLY") || pt.includes("REPOST") || pt.includes("RETWEET")) continue;
    user_direct_n += 1;
    const publishedAt = row.published_at ? Date.parse(String(row.published_at)) : NaN;
    if (Number.isFinite(publishedAt)) {
      const dayKey = new Date(publishedAt).toISOString().slice(0, 10);
      dayHits.set(dayKey, (dayHits.get(dayKey) || 0) + 1);
      if (now - publishedAt <= d14) originals_last_14d += 1;
    }
    const packet = extractEvidencePacket(text, {
      source_id: row.source_id || row.published_at,
      source_type: "ACCOUNT_ACTIVITY",
      published_at: row.published_at,
    });
    const cluster = packet?.topic && packet.topic !== "OTHER" ? packet.topic : "DAILY";
    topicHits.set(cluster, (topicHits.get(cluster) || 0) + 1);
    if (rowHasReaderEntry(row.meta)) {
      entryHits.set(cluster, (entryHits.get(cluster) || 0) + 1);
    }
    const label = packet
      ? `${packet.topic}/${packet.subtopic}`
      : "DAILY/GENERAL";
    if (recent_angle_labels.length < 24 && !recent_angle_labels.includes(label)) {
      recent_angle_labels.push(label);
    }
  }

  const cluster_weights = [...topicHits.entries()]
    .map(([cluster, n]) => ({ cluster, n }))
    .sort((a, b) => b.n - a.n);

  const performance_pattern_hints: string[] = [
    "Transfer entry/flow quality only — never reuse a past winning subject as this week's seed",
    "Likes are algorithm-layer for mix/spacing, not a sentence recipe",
    "X weights multiply predicted actions, not raw counts — never copy weight numbers into a post",
    "Do not install a repeating punchline (e.g. 논란이 자산) across the week",
  ];
  for (const { cluster, n } of cluster_weights) {
    const entry = entryHits.get(cluster) || 0;
    if (entry > 0) {
      performance_pattern_hints.push(
        `${cluster}: ${entry}/${n} USER_DIRECT originals had reply/repost/bookmark entry — infer a NEW angle in that interest, do not clone the post`,
      );
    }
  }
  if (opts.intentText && String(opts.intentText).trim().length >= 10) {
    performance_pattern_hints.push("Operator explicit intent this run outranks default mix");
  }

  const days_with_originals = dayHits.size;
  const avg_originals_on_active_days = days_with_originals
    ? Math.round((user_direct_n / days_with_originals) * 10) / 10
    : 0;

  const cadence = {
    days_with_originals,
    avg_originals_on_active_days,
    originals_last_14d,
    window_days: 30,
  };
  return {
    user_direct_n,
    cluster_weights,
    recent_angle_labels,
    registry_interest_hints: DIMENSION_REGISTRY.map((d) => ({ cluster: d.cluster, dimension: d.dimension })),
    performance_pattern_hints: performance_pattern_hints.slice(0, 10),
    cadence,
    learning: inferLearningState({ user_direct_n, cadence }),
  };
}
export const QUALITY_REFERENCE: any[] = [];

function textOf(seed: Partial<ConcreteSeed>): string {
  return `${seed.concrete_subject || ""} ${seed.point_or_tension || ""}`;
}

const AI_GENERIC_PATTERNS = [
  /ai\s*답변은\s*검증/, /전제를?\s*(확인|밝혀|남기|빠)/, /프롬프트를?\s*(명확|자세)/,
  /수치보다\s*전제/, /전제\s*문장/, /톤을?\s*(한\s*번에\s*)?맞추/, /요약\s*도구가?\s*전제/,
  /always\s*verify/i, /clear\s*prompts?/i, /톤을?\s*맞추다가/, /전제를?\s*먼저/,
];

export function isAiTopicSeed(seed: Partial<ConcreteSeed>): boolean {
  const c = String(seed.cluster || "").toUpperCase();
  const t = textOf(seed);
  return c === "AI_TECH" || /ai_tech|\bai\b|프롬프트|요약\s*도구|초안|모델|llm/i.test(`${c} ${t}`);
}

export function scoreAiSpecificity(seed: Partial<ConcreteSeed>): AiSpecificity {
  if (!isAiTopicSeed(seed)) return "ACCEPTABLE";
  const t = textOf(seed);
  if (AI_GENERIC_PATTERNS.some((r) => r.test(t))) return "GENERIC";
  if (/(grok|그록|gpt|claude|토큰|버전\s*v?\d)/i.test(t)) return "STRONG";
  if (t.length < 24 || /초안|요약|톤|전제/.test(t)) return "GENERIC";
  return "ACCEPTABLE";
}

export function scoreInformationalValue(seed: Partial<ConcreteSeed>): InformationalValue {
  const t = textOf(seed);
  if (!t.trim() || t.length < 12) return "WEAK";
  if (AI_GENERIC_PATTERNS.some((r) => r.test(t))) return "WEAK";
  if (/(패턴|타이밍|병목|회전율|용량|실패율|합류|차선|버전|구조|vs\.?|대비)/i.test(t)) return "STRONG";
  return "ACCEPTABLE";
}

export function scoreCasualEditorialFit(seed: Partial<ConcreteSeed>): {
  fit: "STRONG" | "ACCEPTABLE" | "POOR";
  reclassify_to?: "INFORMATIVE" | "OPINION";
  reasons: string[];
} {
  const t = textOf(seed);
  const reasons: string[] = [];
  if (t.length > 100) reasons.push("LONG");
  if (/보고서|분석\s*결과|요약하면/.test(t)) reasons.push("REPORTISH");
  if (reasons.length >= 2) return { fit: "POOR", reclassify_to: "INFORMATIVE", reasons };
  if (reasons.length === 1) return { fit: "ACCEPTABLE", reasons };
  return { fit: "STRONG", reasons };
}

export function canServeEditorialMode(seed: Partial<ConcreteSeed>, mode: EditorialMode): boolean {
  const m = String(mode || "").toUpperCase();
  if (m === "EXPERIENCE") return !!seed.experience_required || !!seed.creator_evidence_available;
  if (m === "OPINION") return true;
  if (m === "COMPARE") return true;
  if (m === "CASUAL_OBSERVATION") return scoreCasualEditorialFit(seed).fit !== "POOR";
  return true;
}

export function buildModeSupplyReport(pool: ConcreteSeed[], modes: EditorialMode[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of modes) out[m] = pool.filter((s) => canServeEditorialMode(s, m)).length;
  return out;
}

export function parseEditorialMode(raw: string): EditorialMode {
  const m = String(raw || "").toUpperCase();
  if ((WEEKLY_EDITORIAL_MODES as string[]).includes(m)) return m as EditorialMode;
  return "INFORMATIVE";
}

export function isUsableKeywordSubject(raw: unknown): boolean {
  const t = String(raw || "").trim();
  if (t.length >= 8) return true;
  if (t.length < 3) return false;
  if (/^[A-Za-z][A-Za-z0-9._-]{2,}$/.test(t)) return true;
  if (/^[가-힣]{2,7}$/.test(t)) return true;
  return false;
}

export function evaluateEditorialSeedQuality(seed: Partial<ConcreteSeed>, mode: EditorialMode): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!isUsableKeywordSubject(seed.concrete_subject)) reasons.push("WEAK_SUBJECT");
  if (mode === "EXPERIENCE" && !seed.creator_evidence_available) reasons.push("NO_CREATOR_EVIDENCE");
  if (isAiTopicSeed(seed) && scoreAiSpecificity(seed) === "GENERIC") reasons.push("AI_GENERIC");
  return { pass: reasons.length === 0, reasons };
}

const UNSUPPORTED_TEMPORAL = [/오늘\s*(충전|주행|직관)/, /어제\s*(갔|했)/, /이번\s*주\s*(처음|첫)/];
export function temporalSafety(seed: Partial<ConcreteSeed>): { ok: boolean; reasons: string[] } {
  const subject = String(seed.concrete_subject || "");
  if (!UNSUPPORTED_TEMPORAL.some((r) => r.test(subject))) return { ok: true, reasons: [] };
  if (seed.creator_evidence_available) return { ok: true, reasons: ["TEMPORAL_FROM_EVIDENCE"] };
  return { ok: false, reasons: ["UNSUPPORTED_TEMPORAL"] };
}

export function ideaAngleKey(seed: Partial<ConcreteSeed>): string {
  return String(seed.idea_angle_family || `${seed.cluster}|${seed.dimension}|${subjectSignature(String(seed.concrete_subject || "")).slice(0, 40)}`).slice(0, 80);
}

function angleSimilarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/[|\s]+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/[|\s]+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

export function conceptualDiversityScore(candidate: Partial<ConcreteSeed>, selected: Array<Partial<ConcreteSeed>>): number {
  if (!selected.length) return 1;
  const ck = ideaAngleKey(candidate);
  let worst = 1;
  for (const s of selected) {
    const sim = angleSimilarity(ck, ideaAngleKey(s));
    worst = Math.min(worst, 1 - sim);
  }
  return worst;
}

export function conceptualRepetitionLevel(candidate: Partial<ConcreteSeed>, selected: Array<Partial<ConcreteSeed>>): ConceptualRepetition {
  const div = conceptualDiversityScore(candidate, selected);
  if (div >= 0.65) return "LOW";
  if (div >= 0.4) return "MEDIUM";
  return "HIGH";
}

export function ideaAngleGuardAllow(
  candidate: Partial<ConcreteSeed>,
  selected: Array<Partial<ConcreteSeed>>,
  opts?: { softSecond?: boolean }
): { allow: boolean; angle_key: string; same_angle_count: number; reason?: string } {
  const key = ideaAngleKey(candidate);
  let same = 0;
  for (const s of selected) {
    const sk = ideaAngleKey(s);
    if (sk === key || angleSimilarity(key, sk) >= 0.55) same += 1;
  }
  if (same === 0) return { allow: true, angle_key: key, same_angle_count: 0 };
  if (same === 1) {
    const div = conceptualDiversityScore(candidate, selected);
    if (div >= 0.5 || (opts?.softSecond && div >= 0.4)) {
      return { allow: true, angle_key: key, same_angle_count: 1, reason: "SECOND_ANGLE_SOFT_ALLOW" };
    }
    return { allow: false, angle_key: key, same_angle_count: 1, reason: "ANGLE_NEAR_DUPLICATE" };
  }
  return { allow: false, angle_key: key, same_angle_count: same, reason: "ANGLE_REPEAT_DEFER" };
}

export type PublishedEvidenceRow = {
  text: string;
  source_id?: string;
  published_at?: string;
  post_type?: string;
};

/**
 * ORDER 3 + ORDER 0B Manual Leakage Separation.
 * ACCOUNT_ACTIVITY = CREATOR_LEARNING only (topic interest). Never auto SEED from manual body.
 * DIMENSION_REGISTRY is never a production seed body.
 * Local bootstrap emits CREATOR_INTENT only. Weekly volume comes from inferred xAI seeds.
 */
export function bootstrapCandidatesFromDimensions(opts: {
  publishedSubjects: string[];
  intentText?: string;
  publishedEvidence?: PublishedEvidenceRow[];
}): any[] {
  const out: any[] = [];
  const emitted = new Set<string>();
  const rows: PublishedEvidenceRow[] = Array.isArray(opts.publishedEvidence) && opts.publishedEvidence.length
    ? opts.publishedEvidence
    : (opts.publishedSubjects || []).map((t) => ({ text: String(t) }));

  // Learning pass only — do NOT emit seeds from manual ACCOUNT_ACTIVITY rows (ORDER 0B)
  // Never auto SEED from manual body. Signals are collected separately via collectLearnedSeedSignals.
  for (const row of rows.slice(0, 40)) {
    const text = String(row.text || "").trim();
    if (text.length < 12) continue;
    extractEvidencePacket(text, {
      source_id: row.source_id || row.published_at,
      source_type: "ACCOUNT_ACTIVITY",
      published_at: row.published_at,
    });
  }

  // CREATOR_INTENT may still become SEED_SOURCE (not manual body, not registry template)
  const intent = String(opts.intentText || "").trim();
  if (intent.length >= 10) {
    const packet = extractEvidencePacket(intent, { source_id: "INTENT", source_type: "CREATOR_INTENT" });
    if (packet && packet.topic !== "OTHER") {
      const reasoned = reasonSeedSubjectFromPacket(packet);
      const sig = subjectSignature(reasoned.concrete_subject);
      if (!emitted.has(sig) && !/관찰·판단 축/.test(reasoned.concrete_subject)) {
        emitted.add(sig);
        out.push({
          cluster: packet.topic,
          dimension: packet.subtopic || "CREATOR_INTENT",
          concrete_subject: reasoned.concrete_subject,
          subject_signature: sig,
          point_or_tension: reasoned.point_or_tension,
          primary_source: "CREATOR_INTENT",
          supporting_sources: ["CREATOR_INTENT"],
          evidence_source_ids: ["INTENT"],
          creator_evidence_available: true,
          experience_required: false,
          source_type: "CREATOR_INTENT",
          claim_types: ["OBSERVATION"],
          inference_type: "CREATOR_INTENT",
          grounding_status: "GROUNDED",
          grounding_reasons: ["INTENT_PACKET"],
          idea_angle_family: reasoned.idea_angle_family,
          verified_locations: packet.verified_locations,
          verified_entities: packet.entities,
          xai_would_have_been_required: false,
          factual_anchors: (packet.factual_anchors || []).map((a) => String(a).slice(0, 48)).slice(0, 4),
          experience_facts: [],
          static_facts: [],
          current_facts: [],
          creator_opinion: [],
          allowed_facts: (packet.factual_anchors || []).map((a) => String(a).slice(0, 48)).slice(0, 6),
          do_not_invent: ["manual_body_narrative"],
          status: "ELIGIBLE",
          source_role: "SEED_SOURCE",
        });
      }
    }
  }

  return out;
}
