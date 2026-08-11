/**
 * ORDER 4 — Vocabulary Fidelity vs Creator Style Baseline
 * Distance metrics, not forced word insertion.
 * ORDER 3+4 FINAL HOTFIX: detectUnsupportedAdditions uses allowed_facts + verified sets.
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

export type GroundingAllowed = {
  do_not_invent?: string[];
  allowed_facts?: string[];
  factual_anchors?: string[];
  claim_types?: string[];
  grounding_status?: string;
  verified_entities?: string[];
  verified_locations?: string[];
  experience_facts?: string[];
  current_facts?: string[];
};

const LOCATION_DETECT: Array<{ id: string; re: RegExp }> = [
  { id: "BMO", re: /\bbmo\b|비모/i },
  { id: "SEOUL", re: /서울|seoul/i },
  { id: "INCHEON", re: /인천/i },
  { id: "JEJU", re: /제주/i },
  { id: "HONGDAE", re: /홍대/i },
  { id: "SF", re: /샌프란|san\s*francisco/i },
  { id: "REDWOOD_CITY", re: /레드우드|redwood/i },
  { id: "LA", re: /로스앤젤레스|\bla\b(?![a-z])/i },
  { id: "SUPERCHARGER", re: /슈퍼차저|supercharger/i },
];

const ENTITY_DETECT: Array<{ id: string; re: RegExp }> = [
  { id: "FSD", re: /\bfsd\b|오토파일럿/i },
  { id: "CYBERTRUCK", re: /cybertruck|사이버\s*트럭|사이버트럭/i },
  { id: "ROBOTAXI", re: /robotaxi|로보\s*택시/i },
  { id: "LAFC", re: /\blafc\b/i },
  { id: "MODEL_S", re: /model\s*s|모델\s*s|s\s*plaid/i },
  { id: "MODEL_3", re: /model\s*3|모델\s*3|m3\s*perf/i },
  { id: "GROK", re: /\bgrok\b|그록/i },
];

/**
 * ORDER 3+4 FINAL HOTFIX: compare Generated Draft against supplied grounding boundary.
 * Returns list of unsupported additions (empty = grounding_preserved true).
 */
export function detectUnsupportedAdditions(
  text: string,
  allowed: GroundingAllowed
): string[] {
  const t = String(text || "");
  const issues: string[] = [];
  const claims = new Set((allowed.claim_types || []).map((c) => String(c).toUpperCase()));
  const verifiedLoc = new Set(
    (allowed.verified_locations || []).map((x) => String(x).toUpperCase())
  );
  const verifiedEnt = new Set(
    (allowed.verified_entities || []).map((x) => String(x).toUpperCase())
  );
  const factPool = [
    ...(allowed.allowed_facts || []),
    ...(allowed.factual_anchors || []),
    ...(allowed.experience_facts || []),
    ...(allowed.current_facts || []),
  ]
    .map((s) => String(s || "").toLowerCase())
    .filter(Boolean);
  const hasAnyFacts = factPool.length > 0;
  const factBlob = factPool.join(" ");

  for (const loc of LOCATION_DETECT) {
    if (!loc.re.test(t)) continue;
    if (verifiedLoc.size === 0 && !hasAnyFacts) {
      if (["SEOUL", "INCHEON", "JEJU", "HONGDAE"].includes(loc.id)) {
        issues.push(`UNSUPPORTED_LOCATION:${loc.id}`);
      }
      continue;
    }
    if (verifiedLoc.size > 0 && !verifiedLoc.has(loc.id) && !verifiedLoc.has(loc.id.toUpperCase())) {
      if (!loc.re.test(factBlob)) {
        issues.push(`UNSUPPORTED_LOCATION:${loc.id}`);
      }
    }
  }
  if (/서울|인천|제주|홍대|경부고속|한국\s*지하철/.test(t)) {
    const ok =
      [...verifiedLoc].some((v) => /SEOUL|INCHEON|JEJU|HONGDAE|KOREA/i.test(v)) ||
      /서울|인천|제주|홍대/.test(factBlob);
    if (!ok) issues.push("UNSUPPORTED_LOCATION:KOREA_WITHOUT_EVIDENCE");
  }

  if (verifiedEnt.size > 0) {
    for (const ent of ENTITY_DETECT) {
      if (!ent.re.test(t)) continue;
      if (!verifiedEnt.has(ent.id) && !verifiedEnt.has(ent.id.toUpperCase())) {
        if (!ent.re.test(factBlob)) {
          issues.push(`UNSUPPORTED_ENTITY:${ent.id}`);
        }
      }
    }
  }

  const expClaim =
    /직접\s*(해|타|가|보)|내가\s*(해|타|가|보|느)|테스트했|체험했|타\s*보|운전했|충전했|직관\s*(갔|함)|해봤|가봤/.test(
      t
    );
  if (expClaim && !claims.has("PERSONAL_EXPERIENCE")) {
    issues.push("UNSUPPORTED_EXPERIENCE");
  }
  if (expClaim && claims.has("PERSONAL_EXPERIENCE") && hasAnyFacts) {
    const expFacts = (allowed.experience_facts || []).length > 0;
    const anchorLooksExp = /직접|타\s*보|충전|직관|체감|운전|해봤/.test(factBlob);
    if (!expFacts && !anchorLooksExp && allowed.grounding_status !== "GROUNDED") {
      issues.push("UNSUPPORTED_PERSONAL_ACTION");
    }
  }

  const temporal =
    /오늘|어제|방금|퇴근길|출근길|이번\s*주|지금\s*(은|은\s*)?|현재\s*(는|은)?|최신\s*(버전|빌드|업데이트)/.test(
      t
    );
  if (
    temporal &&
    !claims.has("CURRENT_FACT") &&
    !claims.has("PERSONAL_EXPERIENCE")
  ) {
    if (allowed.grounding_status !== "GROUNDED" || !hasAnyFacts) {
      issues.push("UNSUPPORTED_CURRENT_FACT");
    }
  }

  if (/오늘\s*(경기|직관)|현재\s*(경기|스쿼드|라인업)|선수\s*(상태|출전|부상)/.test(t)) {
    const ok =
      claims.has("CURRENT_FACT") ||
      claims.has("PERSONAL_EXPERIENCE") ||
      /경기|직관|라인업|스쿼드/.test(factBlob);
    if (!ok) issues.push("UNSUPPORTED_EVENT_TIME_CONTEXT");
  }

  return [...new Set(issues)];
}
