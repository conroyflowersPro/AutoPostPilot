/**
 * ORDER 1 — Independent Seed Interpretation Layer
 * Seed is NOT a sentence. Interpret meaning first (multiple candidates → select).
 * No reaction mechanism, thinking rail, style, humor, hook, or final writing decided here.
 * No topic/keyword → fixed interpretation mapping.
 * ORDER 0B leakage separation preserved.
 */
export type InterpretationStatus = "INTERPRETATION_OK" | "INTERPRETATION_WEAK" | "INTERPRETATION_BLOCKED";
export type FactualBoundaryItem = { item: string; status: "confirmed" | "inferred" | "unknown" | "prohibited_to_invent" };
export type ExperienceBoundary = {
  creator_experienced: boolean;
  evidence_supported: boolean;
  general_observation_only: boolean;
  must_not_claim_first_person: boolean;
};
export type SeedInterpretation = {
  seed_id: string;
  interpretation_id: string;
  status: InterpretationStatus;
  seed_subject: string;
  what_is_actually_happening: string;
  why_it_might_matter_to_creator: string;
  what_is_new_or_interesting: string;
  concrete_human_element: string;
  possible_reader_connection: string;
  factual_boundaries: FactualBoundaryItem[];
  experience_boundaries: ExperienceBoundary;
  uncertainty: string[];
  repetition_risk: "LOW" | "MEDIUM" | "HIGH";
  interpretation_confidence?: number;
  novelty_signal?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  assumption_risk?: "LOW" | "MEDIUM" | "HIGH";
  candidate_count: number;
  selected_candidate_index: number;
  rejection_reasons?: string[];
  possible_macro_implication?: string | null;
};
export type InterpretSeedInput = {
  seed_id?: string;
  concrete_subject?: string;
  topic?: string;
  subtopic?: string;
  cluster?: string;
  dimension?: string;
  editorial_mode?: string;
  allowed_facts?: string[];
  factual_anchors?: string[];
  experience_facts?: string[];
  source_role?: string;
  source_type?: string;
  source_id?: string;
  point_or_tension?: string;
  creator_evidence_available?: boolean;
  experience_required?: boolean;
  creator_interest_signals?: string[];
  recent_repetition_signals?: string[];
  audience_relevance_signals?: string[];
};
function clean(s: unknown): string { return String(s || "").replace(/\s+/g, " ").trim(); }
function shortNeutralSubject(seed: InterpretSeedInput): string {
  const sub = clean(seed.concrete_subject);
  const cluster = clean(seed.cluster || seed.topic).toUpperCase();
  const dim = clean(seed.dimension || seed.subtopic);
  if (sub.length >= 8 && sub.length <= 90) {
    let s = sub.replace(/^(결국|사실|진짜|솔직히|솔직히\s*말해)\s*/i, "").replace(/\s*(ㅋㅋ+|ㅎㅎ+|…+)$/g, "").trim();
    if (s.length >= 6) return s.slice(0, 80);
  }
  if (cluster && dim) return `${cluster} ${dim}`.slice(0, 60);
  if (cluster) return cluster;
  return sub.slice(0, 60) || "unspecified observation";
}
function extractFactualBoundaries(seed: InterpretSeedInput): FactualBoundaryItem[] {
  const out: FactualBoundaryItem[] = [];
  for (const a of (seed.factual_anchors || []).map(clean).filter(Boolean).slice(0, 8)) out.push({ item: a.slice(0, 80), status: "confirmed" });
  for (const a of (seed.allowed_facts || []).map(clean).filter(Boolean).slice(0, 6)) {
    if (!out.some((x) => x.item === a.slice(0, 80))) out.push({ item: a.slice(0, 80), status: "confirmed" });
  }
  for (const g of ["exact version numbers without evidence", "specific performance numbers without evidence", "current price or policy without evidence", "exact dates of future events", "location claims without verified_locations"]) {
    out.push({ item: g, status: "prohibited_to_invent" });
  }
  if (!(seed.experience_facts && seed.experience_facts.length) && !seed.creator_evidence_available) {
    out.push({ item: "first-person lived experience of this exact event", status: "prohibited_to_invent" });
  }
  return out;
}
function buildExperienceBoundaries(seed: InterpretSeedInput): ExperienceBoundary {
  const hasExp = !!(seed.creator_evidence_available || (seed.experience_facts && seed.experience_facts.length > 0));
  return { creator_experienced: hasExp, evidence_supported: hasExp, general_observation_only: !hasExp, must_not_claim_first_person: !hasExp };
}
function assessRepetitionRisk(seed: InterpretSeedInput): "LOW" | "MEDIUM" | "HIGH" {
  const signals = (seed.recent_repetition_signals || []).map(clean).filter(Boolean);
  if (!signals.length) return "LOW";
  const blob = `${clean(seed.concrete_subject)} ${clean(seed.point_or_tension)}`.toLowerCase();
  let hits = 0;
  for (const sig of signals) {
    const s = sig.toLowerCase();
    if (s.length < 6) continue;
    const st = new Set(s.split(/\s+/).filter((t) => t.length >= 2));
    const bt = new Set(blob.split(/\s+/).filter((t) => t.length >= 2));
    let inter = 0;
    for (const t of st) if (bt.has(t)) inter++;
    const denom = st.size + bt.size - inter || 1;
    if (inter / denom >= 0.45 || (s.length >= 12 && blob.includes(s.slice(0, 20)))) hits++;
  }
  if (hits >= 2) return "HIGH";
  if (hits === 1) return "MEDIUM";
  return "LOW";
}
function detectHumanElement(seed: InterpretSeedInput): string {
  const text = `${clean(seed.concrete_subject)} ${clean(seed.point_or_tension)}`.toLowerCase();
  if (!/시간|돈|습관|불편|선택|대기|줄|피곤|스트레스|체감|직접|해봤|타보|충전했|운전|직관|동선|대기시간|비용|가격체감|사람|관중|좌석|줄서|기다|짜증|편함|불편함/.test(text)) return "NONE";
  if (/충전|대기|슈퍼차저/.test(text)) return "charging wait or session friction in daily use";
  if (/직관|경기|bmo|동선/.test(text)) return "match-day movement and time cost";
  if (/합류|감시|핸들|개입/.test(text)) return "driver attention / intervention load while driving";
  if (/가격|비용|돈/.test(text)) return "money or cost trade-off in real choice";
  return "daily time / effort / choice friction";
}
function detectNovelty(seed: InterpretSeedInput): { signal: "NONE" | "LOW" | "MEDIUM" | "HIGH"; text: string } {
  const text = `${clean(seed.concrete_subject)} ${clean(seed.point_or_tension)}`;
  if (!text || text.length < 10) return { signal: "NONE", text: "none detectable" };
  if (/vs\.?|대비|trade-?off|오히려|예상과|달라|변화|새|처음|아직/.test(text)) return { signal: "MEDIUM", text: "contrast, change, or unexpected tension present in seed" };
  if (/패턴|기준|판단|차이|병목/.test(text)) return { signal: "LOW", text: "judgment criterion or pattern difference" };
  return { signal: "NONE", text: "no clear novelty beyond topic itself" };
}
function whyMightMatter(seed: InterpretSeedInput): string {
  const cluster = clean(seed.cluster || seed.topic).toUpperCase();
  const interests = (seed.creator_interest_signals || []).map((s) => s.toUpperCase());
  const has = (k: string) => interests.some((i) => i.includes(k)) || cluster.includes(k);
  if (has("FSD") || has("CYBER") || has("ROBOTAXI") || has("TESLA")) return "aligns with ongoing product-use and judgment interest (ownership / real-world behavior)";
  if (has("LAFC")) return "aligns with match-day / stadium experience interest";
  if (has("GAMING") || has("DOGE")) return "aligns with secondary leisure / culture interest";
  if (seed.creator_evidence_available) return "supported by creator evidence availability signal";
  return "may matter if it intersects creator high-level interest axes; otherwise low priority";
}
function readerConnection(human: string, novelty: string): string {
  if (human === "NONE" && novelty.startsWith("no clear")) return "NONE";
  if (human !== "NONE") return "possible recognition of similar daily friction or choice";
  if (novelty.includes("contrast") || novelty.includes("change")) return "possible comparison to own expectations or prior belief";
  return "LOW";
}
function buildCandidates(seed: InterpretSeedInput) {
  const subject = shortNeutralSubject(seed);
  const happeningBase = clean(seed.concrete_subject) || subject;
  const tension = clean(seed.point_or_tension);
  const human = detectHumanElement(seed);
  const nov = detectNovelty(seed);
  const why = whyMightMatter(seed);
  const list = [
    {
      seed_subject: subject,
      what_is_actually_happening: tension ? `Observed/presented: ${happeningBase.slice(0, 100)}. Tension note: ${tension.slice(0, 80)}` : `Observed/presented phenomenon: ${happeningBase.slice(0, 120)}`,
      why_it_might_matter_to_creator: why,
      what_is_new_or_interesting: nov.text,
      concrete_human_element: human,
      possible_reader_connection: readerConnection(human, nov.text),
      assumption_risk: "LOW" as const,
    },
    {
      seed_subject: subject,
      what_is_actually_happening: `Core subject under observation is ${subject}. No additional state beyond seed text is assumed.`,
      why_it_might_matter_to_creator: why,
      what_is_new_or_interesting: nov.signal === "NONE" ? "none forced; topic alone is not novelty" : nov.text,
      concrete_human_element: human,
      possible_reader_connection: human === "NONE" ? "NONE" : "possible shared friction recognition",
      assumption_risk: "LOW" as const,
    },
    {
      seed_subject: subject,
      what_is_actually_happening: happeningBase.slice(0, 120),
      why_it_might_matter_to_creator: seed.creator_evidence_available ? "evidence availability raises relevance under experience axis" : "relevance only if it intersects stated high-level interest; otherwise weak",
      what_is_new_or_interesting: nov.signal === "HIGH" || nov.signal === "MEDIUM" ? nov.text : "limited novelty signal",
      concrete_human_element: human === "NONE" ? "NONE" : human,
      possible_reader_connection: readerConnection(human, nov.text),
      assumption_risk: (seed.creator_evidence_available ? "LOW" : "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
    },
  ];
  return list.filter((c, i, arr) => {
    const key = `${c.what_is_actually_happening}|${c.concrete_human_element}|${c.what_is_new_or_interesting}`;
    return arr.findIndex((x) => `${x.what_is_actually_happening}|${x.concrete_human_element}|${x.what_is_new_or_interesting}` === key) === i;
  }).slice(0, 3);
}
function scoreCandidate(c: ReturnType<typeof buildCandidates>[0], seed: InterpretSeedInput, rep: "LOW" | "MEDIUM" | "HIGH"): number {
  let score = 0;
  if (c.seed_subject && clean(seed.concrete_subject).includes(c.seed_subject.slice(0, 12))) score += 2; else score += 1;
  if (c.assumption_risk === "LOW") score += 2; else if (c.assumption_risk === "MEDIUM") score += 1;
  if (c.concrete_human_element !== "NONE") score += 1.5;
  if (!c.what_is_new_or_interesting.startsWith("none") && !c.what_is_new_or_interesting.includes("forced")) score += 1;
  if (rep === "HIGH") score -= 3; else if (rep === "MEDIUM") score -= 1;
  if (c.possible_reader_connection === "NONE" || c.possible_reader_connection === "LOW") score += 0.5;
  return score;
}
export function interpretSeed(input: InterpretSeedInput): SeedInterpretation {
  const seed_id = clean(input.seed_id) || `seed_${Date.now().toString(36)}`;
  const interpretation_id = `interp_${seed_id}_${Math.random().toString(36).slice(2, 8)}`;
  const subjectRaw = clean(input.concrete_subject);
  const rejection_reasons: string[] = [];
  if (!subjectRaw || subjectRaw.length < 6) {
    return {
      seed_id, interpretation_id, status: "INTERPRETATION_BLOCKED", seed_subject: "unspecified",
      what_is_actually_happening: "seed meaning too vague", why_it_might_matter_to_creator: "cannot establish relevance",
      what_is_new_or_interesting: "none", concrete_human_element: "NONE", possible_reader_connection: "NONE",
      factual_boundaries: extractFactualBoundaries(input), experience_boundaries: buildExperienceBoundaries(input),
      uncertainty: ["ambiguous meaning", "incomplete context"], repetition_risk: "LOW", candidate_count: 0,
      selected_candidate_index: -1, rejection_reasons: ["seed meaning too vague"], interpretation_confidence: 0.1,
      novelty_signal: "NONE", assumption_risk: "HIGH", possible_macro_implication: null,
    };
  }
  const factual_boundaries = extractFactualBoundaries(input);
  const experience_boundaries = buildExperienceBoundaries(input);
  const repetition_risk = assessRepetitionRisk(input);
  const candidates = buildCandidates(input);
  const scores = candidates.map((c) => scoreCandidate(c, input, repetition_risk));
  let bestIdx = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bestIdx]) bestIdx = i;
  const best = candidates[bestIdx];
  if (String(input.editorial_mode || "").toUpperCase() === "EXPERIENCE" && experience_boundaries.must_not_claim_first_person) rejection_reasons.push("experience boundary conflict");
  if (repetition_risk === "HIGH") rejection_reasons.push("duplicate/repetition too high");
  let status: InterpretationStatus = "INTERPRETATION_OK";
  if (rejection_reasons.length > 0) status = "INTERPRETATION_BLOCKED";
  else if (best.concrete_human_element === "NONE" && best.what_is_new_or_interesting.startsWith("none") && best.possible_reader_connection === "NONE" && !input.creator_evidence_available) {
    status = "INTERPRETATION_WEAK";
    rejection_reasons.push("limited defensible value");
  } else if (scores[bestIdx] < 2.5) status = "INTERPRETATION_WEAK";
  const uncertainty: string[] = [];
  if (!(input.factual_anchors || []).length) uncertainty.push("incomplete factual anchors");
  if (experience_boundaries.general_observation_only) uncertainty.push("no creator first-person evidence attached");
  if (/아직|추정|가능|보임/.test(subjectRaw + clean(input.point_or_tension))) uncertainty.push("time-sensitive or tentative wording in seed");
  let possible_macro_implication: string | null = null;
  if (/산업|시장|미래|정책|규제|전체/.test(subjectRaw) && (input.factual_anchors || []).length > 0) possible_macro_implication = "seed already contains macro framing; keep only if anchors support";
  return {
    seed_id, interpretation_id, status, seed_subject: best.seed_subject,
    what_is_actually_happening: best.what_is_actually_happening, why_it_might_matter_to_creator: best.why_it_might_matter_to_creator,
    what_is_new_or_interesting: best.what_is_new_or_interesting, concrete_human_element: best.concrete_human_element,
    possible_reader_connection: best.possible_reader_connection, factual_boundaries, experience_boundaries, uncertainty,
    repetition_risk, interpretation_confidence: Math.max(0.15, Math.min(0.95, 0.4 + scores[bestIdx] * 0.1)),
    novelty_signal: detectNovelty(input).signal, assumption_risk: best.assumption_risk, candidate_count: candidates.length,
    selected_candidate_index: bestIdx, rejection_reasons: rejection_reasons.length ? rejection_reasons : undefined,
    possible_macro_implication,
  };
}
export function isInterpretationPassable(interp: SeedInterpretation): boolean {
  return interp.status === "INTERPRETATION_OK" || interp.status === "INTERPRETATION_WEAK";
}
export function isInterpretationBlocked(interp: SeedInterpretation): boolean {
  return interp.status === "INTERPRETATION_BLOCKED";
}
