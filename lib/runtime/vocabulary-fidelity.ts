/**
 * Creator Vocabulary Fidelity
 * Prefer distance-to-corpus signals over word blacklist.
 * Success = “user would actually say this”, not “polished prose”.
 */

export const ABSTRACT_REPORT_MARKERS = [
  "측면", "구성", "핵심", "중요성", "전반", "효과적", "체계적", "종합적", "본질",
  "시사점", "고려사항", "개선점", "결론적으로", "요약하면", "이를 통해", "궁극적으로", "본질적으로", "구조적으로",
];

export const CREATOR_LIVED_MARKERS = [
  "그냥", "솔직히", "실제로", "체감", "ㅋㅋ", "ㅎㅎ", "좀", "되게", "요즘",
  "타보면", "써보면", "가보면", "은근", "의외로", "생각보다",
];

export type VocabularyFidelityResult = {
  score: number;
  distance: number;
  reasons: string[];
  abstract_hits: number;
  lived_hits: number;
  pass: boolean;
};

export type CreatorStyleBaseline = {
  mean_post_chars?: number;
  kk_usage_avg?: number;
  emoji_usage_avg?: number;
  sentence_tendency?: "SHORT" | "MEDIUM" | "LONG";
};

export function scoreVocabularyFidelity(
  text: string,
  baseline?: CreatorStyleBaseline
): VocabularyFidelityResult {
  const t = String(text || "");
  const reasons: string[] = [];
  let distance = 0;
  let abstract_hits = 0;
  for (const m of ABSTRACT_REPORT_MARKERS) {
    if (t.includes(m)) abstract_hits += 1;
  }
  if (abstract_hits >= 1) {
    distance += Math.min(0.45, abstract_hits * 0.12);
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
  let lived_hits = 0;
  for (const m of CREATOR_LIVED_MARKERS) {
    if (t.includes(m)) lived_hits += 1;
  }
  const mean = baseline?.mean_post_chars ?? 112;
  if (t.length > mean * 1.8 && t.length > 200) {
    distance += 0.12;
    reasons.push("LONGER_THAN_CORPUS_BASELINE");
  }
  if ((baseline?.kk_usage_avg ?? 0) > 0.03 && t.length > 90 && !/[ㅋㅎ]/.test(t) && abstract_hits >= 2) {
    distance += 0.05;
    reasons.push("DRY_VS_LIGHT_BASELINE");
  }
  distance = Math.min(1, distance);
  const score = Math.max(0, 1 - distance);
  return {
    score,
    distance,
    reasons,
    abstract_hits,
    lived_hits,
    pass: score >= 0.55 && abstract_hits < 4,
  };
}

export function preservesCreatorPhrasing(
  sourceWhat: string,
  draft: string
): { ok: boolean; reasons: string[] } {
  const src = String(sourceWhat || "");
  const out = String(draft || "");
  const reasons: string[] = [];
  const livedInSrc = CREATOR_LIVED_MARKERS.filter((m) => src.includes(m));
  if (!livedInSrc.length) return { ok: true, reasons: [] };
  const absOut = ABSTRACT_REPORT_MARKERS.filter((m) => out.includes(m)).length;
  const livedOut = CREATOR_LIVED_MARKERS.filter((m) => out.includes(m)).length;
  if (absOut >= 2 && livedOut === 0) {
    reasons.push("LIVED_SOURCE_ABSTRACTED_AWAY");
    return { ok: false, reasons };
  }
  return { ok: true, reasons };
}

export const VOCABULARY_FIDELITY_PROMPT = `VOCABULARY FIDELITY (hard preference — HOW):
- Success = sounds like @Seung4680 would actually say it, NOT “more professional / refined / essay-like”.
- Prefer creator lived vocabulary, endings, and rhythm over polished abstract analysis.
- If the seed/source already uses creator-natural wording, KEEP the meaning and surface — do NOT re-abstract into report language.
- Penalize (avoid): 측면/구성/핵심/중요성/전반/효과적/체계적/종합적/본질/시사점/결론적으로/요약하면/이를 통해.
- Prefer concrete speech: 실제로, 체감, 솔직히, 생각보다, 은근, short 해요체/음슴체 per mode — not textbook connectors.
- Do not “upgrade” casual observation into lecture or whitepaper tone.
- One main point; median length close to real posts (~90–120 when MEDIUM); no padded conclusion paragraph.`;
