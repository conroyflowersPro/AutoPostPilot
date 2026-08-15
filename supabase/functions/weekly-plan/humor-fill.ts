/**
 * Quota-hole fill: personal-interest CASUAL/OPINION with light humor.
 * Not invented lived experience. Keyword subjects from Creator DNA are valid.
 */
import type { ConcreteSeed } from "./seed-engine.ts";

export const HUMOR_SOURCE_TYPE = "HUMOR_FILL";

/** Keyword-only DNA interest directions. Not finished posts. Not first-person claims. */
export const DNA_HUMOR_KEYWORD_SEEDS: Array<{ cluster: string; concrete_subject: string }> = [
  { cluster: "FSD", concrete_subject: "FSD 감독 화면" },
  { cluster: "CYBERTRUCK", concrete_subject: "사이버트럭 사이드미러" },
  { cluster: "TESLA", concrete_subject: "테슬라 앱 알림 겹침" },
  { cluster: "LAFC", concrete_subject: "LAFC 홈 경기" },
  { cluster: "GAMING", concrete_subject: "게임 매치메이킹" },
  { cluster: "FSD", concrete_subject: "차선 합류 망설임" },
  { cluster: "CYBERTRUCK", concrete_subject: "사이버트럭 충전 줄" },
  { cluster: "GAMING", concrete_subject: "한 판 큐 대기" },
  { cluster: "LAFC", concrete_subject: "경기장 입구 줄" },
  { cluster: "TESLA", concrete_subject: "테슬라 앱 화면 가림" },
];

export function isHumorFillSeed(seed: { source_type?: string; source_kind?: string }): boolean {
  const st = String(seed.source_type || seed.source_kind || "").toUpperCase();
  return st.includes("HUMOR");
}

export function humorRingPromptLines(): string[] {
  return [
    "QUOTA HOLE FILL — personal-interest CASUAL/OPINION with light observational humor.",
    "Subjects from Creator DNA interests (FSD/Cybertruck/Tesla product/LAFC/gaming). Keyword subjects are valid.",
    "FORBIDDEN: inventing a drive, a test, a price, a date, or a private event. No first-person lived claim without evidence.",
    "Humor is wording/observation, not a fake story and not forced ㅋㅋ on every seed.",
    "Never EXPERIENCE mode on these hole-fill seeds. Do not clone the same punchline.",
  ];
}

export function localHumorKeywordSeeds(needed: number, heldSubjects: string[]): ConcreteSeed[] {
  const n = Math.max(0, Math.round(Number(needed) || 0));
  if (n < 1) return [];
  const held = new Set((heldSubjects || []).map((s) => String(s || "").toLowerCase().slice(0, 80)));
  const out: ConcreteSeed[] = [];
  let i = 0;
  let guard = 0;
  while (out.length < n && guard < 40) {
    guard += 1;
    const base = DNA_HUMOR_KEYWORD_SEEDS[i % DNA_HUMOR_KEYWORD_SEEDS.length];
    i += 1;
    const subject = base.concrete_subject;
    const sig = subject.toLowerCase().slice(0, 80);
    if (held.has(sig)) continue;
    held.add(sig);
    out.push({
      seed_id: `humor-${out.length + 1}`,
      cluster: base.cluster,
      dimension: "HUMOR_FILL",
      concrete_subject: subject,
      subject_signature: sig,
      source_type: HUMOR_SOURCE_TYPE,
      source_role: "SEED_SOURCE",
      requested_editorial_mode: "CASUAL_OBSERVATION",
      editorial_mode: "CASUAL_OBSERVATION",
      creator_evidence_available: false,
      point_or_tension: "관찰 유머 · 경험 날조 금지",
      status: "ELIGIBLE",
    } as ConcreteSeed);
  }
  return out;
}
