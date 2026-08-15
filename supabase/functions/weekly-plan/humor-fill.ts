/**
 * Quota-hole fill: personal-interest CASUAL/OPINION with light humor.
 * Grok infers the subjects. This file is prompt + clone-guard only —
 * never a frozen topic list that becomes the week's seeds.
 */

export const HUMOR_SOURCE_TYPE = "HUMOR_FILL";

/**
 * 11.5.6 injected these as the week when Grok was empty.
 * They are last week's clones, not inferred seeds. Drop if Grok emits them.
 */
export const FORBIDDEN_FROZEN_HUMOR_SUBJECTS = [
  "FSD 감독 화면",
  "사이버트럭 사이드미러",
  "테슬라 앱 알림 겹침",
  "LAFC 홈 경기",
  "게임 매치메이킹",
  "차선 합류 망설임",
  "사이버트럭 충전 줄",
  "한 판 큐 대기",
  "경기장 입구 줄",
  "테슬라 앱 화면 가림",
];

function compactSubject(s: string): string {
  return String(s || "").replace(/\s+/g, "").toLowerCase();
}

export function isFrozenHumorClone(subject: string): boolean {
  const t = compactSubject(subject);
  if (t.length < 6) return false;
  // Hard reject only the frozen subject itself. A longer/new situation that
  // shares Creator vocabulary is a candidate, not automatically a clone.
  return FORBIDDEN_FROZEN_HUMOR_SUBJECTS.some((s) => t === compactSubject(s));
}

export function isHumorFillSeed(seed: { source_type?: string; source_kind?: string }): boolean {
  const st = String(seed.source_type || seed.source_kind || "").toUpperCase();
  return st.includes("HUMOR");
}

export function humorRingPromptLines(): string[] {
  return [
    "QUOTA HOLE FILL — infer NEW personal-interest CASUAL/OPINION directions with light observational humor.",
    "Infer from Creator DNA interest domains (FSD / Cybertruck / Tesla product / LAFC / gaming). Mix the domains. Do not rotate one canned phrase list.",
    "Do not copy already_held_seeds or recent_published_angles as concrete_subject. Do not emit example phrases from this prompt as seed bodies.",
    "FORBIDDEN: inventing a drive, a test, a price, a date, or a private event. No first-person lived claim without evidence.",
    "Humor is wording/observation, not a fake story and not forced ㅋㅋ on every seed.",
    "Never EXPERIENCE mode on these hole-fill seeds. Distinct situation each seed.",
  ];
}
