/**
 * Dynamic Concrete Seed Engine v9.1.0 — Edge pack (quality gates + idea angle + mode helpers)
 * No production concrete bootstrap templates. ORDER 3 evidence-packet reasoning.
 * ORDER 3+4 FINAL HOTFIX: allowed_facts / factual_anchors propagation.
 * ORDER 0B: Manual posts never auto SEED_SOURCE; DIMENSION_REGISTRY abstract seeds.
 */
import {
  extractEvidencePacket,
  reasonSeedSubjectFromPacket,
  type EvidencePacket,
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

export function evaluateEditorialSeedQuality(seed: Partial<ConcreteSeed>, mode: EditorialMode): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!seed.concrete_subject || String(seed.concrete_subject).length < 8) reasons.push("WEAK_SUBJECT");
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
 * SEED_SOURCE = DIMENSION_REGISTRY abstract + CREATOR_INTENT.
 */
export function bootstrapCandidatesFromDimensions(opts: {
  publishedSubjects: string[];
  intentText?: string;
  publishedEvidence?: PublishedEvidenceRow[];
}): any[] {
  const out: any[] = [];
  const emitted = new Set<string>();
  const packets: EvidencePacket[] = [];
  const topicHits = new Map<string, number>();
  const rows: PublishedEvidenceRow[] = Array.isArray(opts.publishedEvidence) && opts.publishedEvidence.length
    ? opts.publishedEvidence
    : (opts.publishedSubjects || []).map((t) => ({ text: String(t) }));

  // Learning pass only — do NOT emit seeds from manual ACCOUNT_ACTIVITY rows (ORDER 0B)
  for (const row of rows.slice(0, 40)) {
    const text = String(row.text || "").trim();
    if (text.length < 12) continue;
    const packet = extractEvidencePacket(text, {
      source_id: row.source_id || row.published_at,
      source_type: "ACCOUNT_ACTIVITY",
      published_at: row.published_at,
    });
    if (!packet) continue;
    if (packet.topic === "OTHER" && packet.entities.length === 0) continue;
    packets.push(packet);
    topicHits.set(packet.topic, (topicHits.get(packet.topic) || 0) + 1);
  }

  // Abstract SEED_SOURCE from DIMENSION_REGISTRY (weighted by observed interest)
  const rankedDims = [...DIMENSION_REGISTRY].sort((a, b) => {
    const ha = topicHits.get(a.cluster) || 0;
    const hb = topicHits.get(b.cluster) || 0;
    if (hb !== ha) return hb - ha;
    return (b.core ? 1 : 0) - (a.core ? 1 : 0);
  });
  for (const dim of rankedDims) {
    const abstractSubject = `${dim.cluster} ${dim.dimension} 관찰·판단 축`.slice(0, 90);
    const sig = subjectSignature(`${dim.cluster}|${dim.dimension}|abstract`);
    if (emitted.has(sig)) continue;
    emitted.add(sig);
    const hit = topicHits.get(dim.cluster) || 0;
    out.push({
      cluster: dim.cluster,
      dimension: dim.dimension,
      concrete_subject: abstractSubject,
      subject_signature: sig,
      point_or_tension: "차원 기반 신규 각도 — 수제글 원문·결론 재사용 금지",
      primary_source: "DIMENSION_REGISTRY",
      supporting_sources: hit > 0 ? ["DIMENSION_REGISTRY", "CREATOR_LEARNING_SIGNAL"] : ["DIMENSION_REGISTRY"],
      evidence_source_ids: [],
      creator_evidence_available: hit > 0,
      experience_required: false,
      source_type: "DIMENSION_REGISTRY",
      claim_types: ["OBSERVATION"],
      inference_type: "DIMENSION_ABSTRACT",
      grounding_status: "GROUNDED",
      grounding_reasons: ["REGISTRY_ABSTRACT"],
      idea_angle_family: `${dim.cluster}|${dim.dimension}|abstract`,
      verified_locations: [],
      verified_entities: [],
      relationship_evidence_ids: [],
      xai_would_have_been_required: false,
      factual_anchors: [],
      experience_facts: [],
      static_facts: [],
      current_facts: [],
      creator_opinion: [],
      allowed_facts: [],
      do_not_invent: ["manual_body_narrative", "manual_punchline", "manual_conclusion"],
      status: "ELIGIBLE",
      source_role: "SEED_SOURCE",
    });
  }

  // CREATOR_INTENT may still become SEED_SOURCE (not manual body)
  const intent = String(opts.intentText || "").trim();
  if (intent.length >= 10) {
    const packet = extractEvidencePacket(intent, { source_id: "INTENT", source_type: "CREATOR_INTENT" });
    if (packet && packet.topic !== "OTHER") {
      const reasoned = reasonSeedSubjectFromPacket(packet);
      const sig = subjectSignature(reasoned.concrete_subject);
      if (!emitted.has(sig)) {
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

  void packets.length;
  return out;
}
