/**
 * ORDER 2 — Natural Humor Check + Final Creator Generation Quality
 * No separate humor engine. Humor only when natural.
 * Writing density + Creator Fit guidance for final expression stage.
 */

/** Prompt fragment injected at final Writing DNA stage */
export function buildNaturalHumorAndDensityInstructions(): string {
  return `
NATURAL HUMOR CHECK (final expression stage only — not a content strategy):

Allow a small natural humor beat ONLY if ALL of the following hold:
- It connects directly to the Core Thought already decided
- It does not interrupt or rewrite the Thinking Rail flow
- It matches how this Creator actually speaks (light 위위 / observational aside OK; forced punchlines not OK)
- It does not feel like a joke was bolted on after the fact
- It makes the core point more memorable, not less serious for its own sake
- The Creator themselves might 피식 at it

If no suitable natural point exists → do NOT add humor.
Do NOT change Editorial Mode because humor appeared.
Do NOT force 위위, memes, or internet slang the Creator does not use.
Do NOT invent situations or experiences as comedy material.
Do NOT change Core Thought or Thinking Rail to create a joke opportunity.
Humor is never a goal. Absence of humor is a normal PASS.

FINAL WRITING DENSITY (priority over "complete-looking" prose):
- Prefer easy-to-read sentences
- Cut unnecessary explanation and repeated meaning
- Keep one core viewpoint
- Preserve Creator rhythm (not report/consulting tone)
- Avoid over-polished AI smoothness
- Avoid long sermon-style conclusions
- Do not lengthen a post just to make it feel finished
- Short posts that leave a thought are better than long complete essays

CREATOR FIT (final check before output):
- Would this Creator actually unfold the thought this way?
- Does the wording feel spoken rather than generated?
- Is explanation simple and natural?
- Does light expression appear only where it fits?
- Is the post slightly imperfect in a human way (not over-organized)?
- Does the breathing / pacing match the Creator?
`;
}

/** Lightweight post-hoc flags for Judge (no separate scoring engine) */
export type HumorDensityDiagnostics = {
  natural_humor_present: boolean;
  natural_humor_fit: "N/A" | "PASS" | "RISK" | "UNKNOWN";
  writing_density_note: string | null;
  ai_tone_risk: "LOW" | "MED" | "HIGH" | "UNKNOWN";
};

/**
 * Heuristic diagnostics only — does not rewrite content.
 * natural_humor_fit is N/A when no humor markers; never penalize absence.
 */
export function diagnoseHumorAndDensity(content: string): HumorDensityDiagnostics {
  const t = String(content || "");
  const humorMarkers =
    /위위|흐흐|ᄏ\s|피식|어이없|웃기|장난|ㅎ|아이고|와\.\.|좀 이상|무섭네/i.test(t);
  const aiToneHits =
    (t.match(/전반적으로|이러한|따라서|결론적으로|살펴보면|중요한 점은|다음과 같/g) || [])
      .length;
  const length = t.replace(/\s/g, "").length;

  let natural_humor_fit: HumorDensityDiagnostics["natural_humor_fit"] = "N/A";
  if (humorMarkers) {
    const forced = (t.match(/위위/g) || []).length >= 3 || /ㄹㅇ|개웃|레전드|미침위위위/i.test(t);
    natural_humor_fit = forced ? "RISK" : "PASS";
  }

  let ai_tone_risk: HumorDensityDiagnostics["ai_tone_risk"] = "LOW";
  if (aiToneHits >= 3 || length > 900) ai_tone_risk = "HIGH";
  else if (aiToneHits >= 1 || length > 550) ai_tone_risk = "MED";

  return {
    natural_humor_present: humorMarkers,
    natural_humor_fit,
    writing_density_note:
      length > 700 ? "possibly_long" : length < 80 ? "very_short" : null,
    ai_tone_risk,
  };
}

/** Judge field names to surface on each post (integrated into existing response) */
export const ORDER2_JUDGE_FIELDS = [
  "natural_humor_fit",
  "creator_fit",
  "reaction_potential",
  "writing_density",
  "ai_tone_risk",
  "unnecessary_length",
] as const;
