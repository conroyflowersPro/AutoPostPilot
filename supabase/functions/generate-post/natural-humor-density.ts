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
- It matches how this Creator actually speaks (light ㅋㅋ / observational aside OK; forced punchlines not OK)
- It does not feel like a joke was bolted on after the fact
- It makes the core point more memorable, not less serious for its own sake
- The Creator themselves might 피식 at it

If no suitable natural point exists → do NOT add humor.
Do NOT change Editorial Mode because humor appeared.
Do NOT force ㅋㅋ, memes, or internet slang the Creator does not use.
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
  // Hangul filler + common light-laugh / observational markers
  const humorMarkers =
    /\u314b\u314b|\u314e\u314e|\u314b\s|\ud53c\uc2dd|\uc5b4\uc774\uc5c6|\uc6c3\uae30|\uc7a5\ub09c|\u314e|\uc544\uc774\uace0|\uc640\.\.|\uc880 \uc774\uc0c1|\ubb34\uc12d\ub124/i.test(
      t
    );
  const aiToneHits =
    (t.match(/\uc804\ubc18\uc801\uc73c\ub85c|\uc774\ub7ec\ud55c|\ub530\ub77c\uc11c|\uacb0\ub860\uc801\uc73c\ub85c|\uc0b4\ud3b4\ubcf4\uba74|\uc911\uc694\ud55c \uc810\uc740|\ub2e4\uc74c\uacfc \uac19/g) || [])
      .length;
  const length = t.replace(/\s/g, "").length;

  let natural_humor_fit: HumorDensityDiagnostics["natural_humor_fit"] = "N/A";
  if (humorMarkers) {
    const forced =
      (t.match(/\u314b\u314b/g) || []).length >= 3 ||
      /\u3139\u3147|\uac1c\uc6c3|\ub808\uc804\ub4dc|\ubbf8\uce68\u314b\u314b\u314b/i.test(t);
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
