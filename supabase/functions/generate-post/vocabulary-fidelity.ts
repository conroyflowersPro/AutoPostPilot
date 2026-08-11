/**
 * ORDER 4 — Vocabulary Fidelity vs Creator Style Baseline
 * Distance metrics, not forced word insertion.
 */

import { getStyleBaseline } from "./creator-style-data.ts";

export const ABSTRACT_REPORT_MARKERS = [
  "측면", "구성", "핵심", "중요성", "전반", "효과적", "체계적", "종합적", "본질",
  "시사점", "고려사항", "개선점", "결론적으로", "요약하면", "이를 통해", "궁극적으로",
  "본질적으로", "구조적으로",
];

export type VocabularyFidelityResult = {
  score: number;
  distance: number;
  reasons: string[];
  abstract_hits: number;
  length_distance: number;
  register_distance: number;
  abstraction_distance: number;
  pass: boolean;
};

export function scoreVocabularyFidelity(text: string): VocabularyFidelityResult {
  const t = String(text || "");
  const baseline = getStyleBaseline();
  const reasons: string[] = [];
  let distance = 0;

  let abstract_hits = 0;
  for (const m of ABSTRACT_REPORT_MARKERS) {
    if (t.includes(m)) abstract_hits += 1;
  }
  const abstraction_distance = Math.min(0.5, abstract_hits * 0.12);
  if (abstract_hits >= 1) {
    distance += abstraction_distance;
    reasons.push(`ABSTRACT_REPORT_MARKERS:${abstract_hits}`);
  }

  if (/따라서|결론적으로|요약하면|이를\s*통해|궁극적으로/.test(t)) {
    distance += 0.2;
    reasons.push("REPORT_CONNECTOR");
  }
  if ((t.match(/하는\s*것|된\s*부분|에\s*있어|에\s*대한/g) || []).length >= 2) {
    distance += 0.1;
    reasons.push("NOMINALIZATION_STACK");
  }

  const len = t.trim().length;
  const median = baseline.median_post_chars || 96;
  let length_distance = 0;
  if (len > median * 2.2) {
    length_distance = Math.min(0.25, (len - median * 2.2) / 400);
    distance += length_distance;
    reasons.push("LONGER_THAN_CORPUS_BASELINE");
  } else if (len > 0 && len < median * 0.25 && len < 20) {
    length_distance = 0.08;
    distance += length_distance;
    reasons.push("SHORTER_THAN_CORPUS_BASELINE");
  }

  let register_distance = 0;
  const formal = (t.match(/습니다\.|됩니다\.|입니다\./g) || []).length;
  const casual = (t.match(/해요|네요|거예요|ㅋㅋ|ㅎㅎ|음\.|임\.|함\./g) || []).length;
  if (formal >= 3 && casual === 0) {
    register_distance = 0.15;
    distance += register_distance;
    reasons.push("REGISTER_TOO_FORMAL_VS_CORPUS");
  }

  if ((t.match(/그리고|또한|더불어/g) || []).length >= 3) {
    distance += 0.08;
    reasons.push("CONNECTOR_REPETITION");
  }

  distance = Math.min(1, distance);
  const score = Math.max(0, 1 - distance);
  return {
    score,
    distance,
    reasons,
    abstract_hits,
    length_distance,
    register_distance,
    abstraction_distance,
    pass: score >= 0.55 && abstract_hits < 4,
  };
}

export function detectUnsupportedAdditions(
  text: string,
  allowed: {
    do_not_invent?: string[];
    allowed_facts?: string[];
    claim_types?: string[];
    grounding_status?: string;
  }
): string[] {
  const t = String(text || "");
  const issues: string[] = [];
  const claims = new Set((allowed.claim_types || []).map((c) => String(c).toUpperCase()));
  if (/오늘|어제|방금|퇴근길|출근길/.test(t) && !claims.has("CURRENT_FACT") && !claims.has("PERSONAL_EXPERIENCE")) {
    if (allowed.grounding_status !== "GROUNDED") {
      issues.push("POSSIBLE_TEMPORAL_INVENTION");
    }
  }
  if (/직접\s*(해|타|가|보)|테스트했|체험했/.test(t) && !claims.has("PERSONAL_EXPERIENCE")) {
    issues.push("POSSIBLE_EXPERIENCE_INVENTION");
  }
  return issues;
}
