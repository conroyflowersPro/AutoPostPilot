/**
 * STATIC REGISTRY — Editorial mode rules (no concrete post content).
 */
export type EditorialMode =
  | "INFORMATIVE"
  | "COMPARE"
  | "OPINION"
  | "EXPERIENCE"
  | "CASUAL_OBSERVATION";

export const WEEKLY_EDITORIAL_MODES: EditorialMode[] = [
  "INFORMATIVE",
  "COMPARE",
  "OPINION",
  "EXPERIENCE",
  "CASUAL_OBSERVATION",
];

/** Weekly plan never allocates HUMOR */
export const WEEKLY_HUMOR_ALLOWED = false as const;

export const MODE_SEED_GUIDANCE: Record<EditorialMode, string> = {
  INFORMATIVE:
    "INFORMATIVE: concrete change/feature/structure/problem/technical difference worth explaining. Reject generic advice (전제 확인, 검증해야 한다, 중요하다). Prefer real mechanisms, timings, bottlenecks, measurable differences.",
  COMPARE:
    "COMPARE: A vs B, before vs now, expectation vs reality, pros vs cons, alternative approaches. Subject must contain a real contrast.",
  OPINION:
    "OPINION: trade-off, debate point, or view that differs from common assumption — material where Creator can attach a stance. Not a dry fact dump.",
  EXPERIENCE:
    "EXPERIENCE: only subjects backed by Creator Evidence (archive, intent, manual post, real photo/video/context). Never invent personal experience.",
  CASUAL_OBSERVATION:
    "CASUAL_OBSERVATION: momentary observation or short reaction that stands without long analysis. If needs cause/structure/criteria → not CASUAL (use INFORMATIVE/OPINION). Not humor. Tesla/FSD ok if momentary.",
};

export const DEFAULT_EDITORIAL_RATIO: Record<EditorialMode, number> = {
  INFORMATIVE: 28,
  COMPARE: 18,
  OPINION: 18,
  EXPERIENCE: 18,
  CASUAL_OBSERVATION: 18,
};
