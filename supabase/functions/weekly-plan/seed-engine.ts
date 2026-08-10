/**
 * Dynamic Concrete Seed Engine v9.1.0 — Edge pack (quality gates + idea angle + mode helpers)
 * No production concrete bootstrap templates. Full pack: AutoPostPilot-v9.1.0-EDGE-SOURCES.zip
 */
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
    passed.push({
      seed_id: nextId(),
      cluster: String(r.cluster || "OTHER"),
      dimension: String(r.dimension || "GENERAL"),
      concrete_subject: String(r.concrete_subject),
      subject_signature: subjectSignature(r.concrete_subject),
      primary_source: r.primary_source || "XAI_EXPANSION",
      supporting_sources: r.supporting_sources || ["DIMENSION_REGISTRY"],
      status: "ELIGIBLE",
      creator_evidence_available: !!r.creator_evidence_available,
      point_or_tension: r.point_or_tension,
      requested_editorial_mode: r.requested_editorial_mode,
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
  const analysis = /(원인|구조|판단\s*기준|여러\s*조건|기술[적]?\s*의미|때문에|분석|지표|병목)/i.test(t);
  if (analysis) return { fit: "POOR", reclassify_to: "INFORMATIVE", reasons: ["CASUAL_TOO_ANALYTICAL"] };
  if (t.length <= 90) return { fit: "ACCEPTABLE", reasons: ["CASUAL_SHORT"] };
  return { fit: "POOR", reclassify_to: "INFORMATIVE", reasons: ["CASUAL_NEEDS_EXPLANATION"] };
}

const UNSUPPORTED_TEMPORAL = [/오늘/, /어제/, /이번\s*주/, /퇴근길/, /출근길/, /방금/, /지금\s*막/];
export function seedTemporalGrounding(seed: Partial<ConcreteSeed>): { ok: boolean; reasons: string[] } {
  const subject = String(seed.concrete_subject || "");
  if (!UNSUPPORTED_TEMPORAL.some((r) => r.test(subject))) return { ok: true, reasons: [] };
  if (seed.creator_evidence_available) return { ok: true, reasons: ["TEMPORAL_FROM_EVIDENCE"] };
  return { ok: false, reasons: ["UNSUPPORTED_TEMPORAL_CONTEXT"] };
}

export function evaluateEditorialSeedQuality(
  seed: Partial<ConcreteSeed>,
  requested?: string
): { pass: boolean; reasons: string[]; ai_specificity?: AiSpecificity; informational_value?: InformationalValue; casual_fit?: string } {
  const mode = String(requested || seed.requested_editorial_mode || "").toUpperCase();
  const ground = seedTemporalGrounding(seed);
  if (!ground.ok) return { pass: false, reasons: ground.reasons };
  if (isAiTopicSeed(seed)) {
    const ai = scoreAiSpecificity(seed);
    if (ai === "GENERIC") return { pass: false, ai_specificity: ai, reasons: ["AI_GENERIC"] };
  }
  if (mode === "INFORMATIVE") {
    const iv = scoreInformationalValue(seed);
    if (iv === "WEAK") return { pass: false, informational_value: iv, reasons: ["INFO_WEAK"] };
  }
  if (mode === "CASUAL_OBSERVATION") {
    const c = scoreCasualEditorialFit(seed);
    if (c.fit === "POOR") return { pass: false, casual_fit: c.fit, reasons: c.reasons };
  }
  if (mode === "EXPERIENCE" && !seed.creator_evidence_available) {
    return { pass: false, reasons: ["NEEDS_CREATOR_CONTEXT"] };
  }
  return { pass: true, reasons: [] };
}

export function canServeEditorialMode(seed: Partial<ConcreteSeed>, mode: string): boolean {
  const m = String(mode || "").toUpperCase();
  if (m === "HUMOR") return false;
  return evaluateEditorialSeedQuality(seed, m).pass && (m !== "EXPERIENCE" || !!seed.creator_evidence_available);
}

export function parseEditorialMode(v: unknown): EditorialMode | undefined {
  const u = String(v || "").toUpperCase();
  if (u === "HUMOR") return undefined;
  return (WEEKLY_EDITORIAL_MODES as string[]).includes(u) ? (u as EditorialMode) : undefined;
}

export function modeAwareExpandInstructions(mode: string): string {
  const m = String(mode || "").toUpperCase();
  if (m === "COMPARE") return "Provide contrast axes only; no forced opinion.";
  if (m === "EXPERIENCE") return "Only evidence-backed first-person material; never invent.";
  if (m === "CASUAL_OBSERVATION") return "Short momentary observation; no analysis essay.";
  if (m === "OPINION") return "Trade-off or stance space; not pure fact dump.";
  return "Concrete informative subject; reject generic advice.";
}

export function annotateSeedsWithModeFitness(seeds: ConcreteSeed[], mode: string): ConcreteSeed[] {
  return (seeds || []).map((s) => {
    const q = evaluateEditorialSeedQuality(s, mode);
    return {
      ...s,
      requested_editorial_mode: mode,
      editorial_fit: q.pass ? "ACCEPTABLE" : "POOR",
      status: q.pass ? (s.status || "ELIGIBLE") : "HOLD",
    };
  });
}

export function buildModeSupplyReport(seeds: ConcreteSeed[], modes: string[] = WEEKLY_EDITORIAL_MODES as any): any {
  const per_mode: Record<string, { eligible: number; short: number }> = {};
  let mode_supply_low = false;
  for (const m of modes) {
    const eligible = (seeds || []).filter((s) => canServeEditorialMode(s, m) && isSelectableStatus(s.status as any)).length;
    per_mode[m] = { eligible, short: eligible === 0 ? 1 : 0 };
    if (eligible === 0) mode_supply_low = true;
  }
  return { mode_supply_low, per_mode };
}

const ANGLE_LOCATION_STRIP = [/공항|airport|경기장|stadium|호텔|hotel|bmo|집\s*근처|목적지|도심|퇴근길|학교\s*앞|공사\s*구간|고속도로|램프|횡단보도|우회전|합류\s*램프/gi];
export function ideaAngleKey(seed: Partial<ConcreteSeed>): string {
  let t = `${seed.concrete_subject || ""} ${seed.point_or_tension || ""}`.toLowerCase();
  for (const r of ANGLE_LOCATION_STRIP) t = t.replace(r, " ");
  t = t
    .replace(/로보\s*택시|robotaxi/g, "robotaxi")
    .replace(/주정차|승하차|curb|픽업|대기열|인프라/g, "curbops")
    .replace(/회전율|utilization|실패율/g, "turnover")
    .replace(/병목|용량\s*부족|공간\s*부족|스케일\s*논의/g, "bottleneck")
    .replace(/감시|감독|집중도|구간\s*유형|단조|합류/g, "supervision_load")
    .replace(/전제|검증|프롬프트|톤\s*맞|요약\s*도구/g, "ai_generic")
    .replace(/[^\w가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cluster = String(seed.cluster || "").toUpperCase();
  if (cluster === "FSD" && /supervision_load/.test(t)) return "FSD|thesis_supervision_load_by_segment";
  if (cluster === "ROBOTAXI" && /curbops/.test(t) && /bottleneck|turnover/.test(t)) return "ROBOTAXI|thesis_curbside_limits_turnover";
  if (cluster === "AI_TECH" && /ai_generic/.test(t)) return "AI_TECH|thesis_ai_premise_hygiene";
  const tokens = t.split(" ").filter((w) => w.length >= 2).slice(0, 8);
  return `${cluster}|${tokens.join("_")}`.slice(0, 120) || `${cluster}|unknown`;
}

export function angleSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const ta = new Set(a.split(/[|_]/).filter(Boolean));
  const tb = new Set(b.split(/[|_]/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

export function conceptualDiversityScore(
  candidate: Partial<ConcreteSeed>,
  selected: Array<Partial<ConcreteSeed>>
): number {
  if (!selected.length) return 1;
  const ck = ideaAngleKey(candidate);
  let maxSim = 0;
  for (const s of selected) {
    maxSim = Math.max(maxSim, angleSimilarity(ck, ideaAngleKey(s)));
  }
  return 1 - maxSim;
}

export function conceptualRepetitionLevel(
  candidate: Partial<ConcreteSeed>,
  selected: Array<Partial<ConcreteSeed>>
): ConceptualRepetition {
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

/** Production: no concrete bootstrap stories */
export function bootstrapCandidatesFromDimensions(_opts: {
  publishedSubjects: string[];
  intentText?: string;
}): any[] {
  return [];
}
