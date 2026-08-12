/**
 * X Account Growth OS v10 — ORDER 3
 * Contextual Style + Creator Self-Disclosure + Natural Humor
 *
 * NOT a new style engine. NOT fixed AI voice for every post.
 * Reason per seed which register/rhythm fits — inside existing Creator DNA bounds.
 * Humor is not a separate mode requirement; only when situation earns it.
 */

export type StyleRegisterHint =
  | "hae_yo"
  | "eumseum"
  | "mixed"
  | "compressed"
  | "conversational"
  | "observation"
  | "experience_narration"
  | "explanatory"
  | "diary_like"
  | "self_deprecating"
  | "plain";

export type ContextualStyleDecision = {
  register_hint: StyleRegisterHint;
  self_disclosure_fit: boolean;
  natural_humor_fit: boolean;
  reason: string;
};

export function buildContextualStyleInstructions(): string {
  return `
CONTEXTUAL STYLE (v10 ORDER 3 — after Reaction Mechanism + Everyday Language):

Do NOT apply one fixed "learned user voice" to every post.
Before final wording, reason internally:

1) Is this info, experience share, observation, light self-open, or debate?
2) Audience: general public or a specific community?
3) What rhythm fits the chosen Reaction Mechanism?
4) On this seed is the writer serious / absurd / amused / slightly embarrassed / curious?
5) Better short, or need a little scene?
6) 해요체 / 음슴체 / natural mix — which feels least forced?
7) Inside Creator DNA, is any recent register overused? Avoid mechanical rotation.
8) Across the profile, should this feel like one person writing differently by situation — not AI mimicking many styles?

Allowed surfaces (choose by reasoning, NEVER cycle as a template list):
해요체 | 음슴체 | natural mix | compressed | conversational | observation |
experience narration | explanatory | diary-like | community-native | self-deprecating | plain calm

Creator DNA / Writing DNA remain the outer HOW bound (vocab, length habits, authenticity).
Contextual style only picks the situational register inside that bound.

CREATOR SELF-DISCLOSURE:
If it lowers the reader's cost to share their own story, the writer may show a real slice of self first.
Allowed materials ONLY when already grounded in seed/evidence/Creator known facts:
- real habit, real choice, light self-irony, slightly awkward self, small joke about self
FORBIDDEN: invent experience, place, action, event, or personal fact that does not exist.

NATURAL HUMOR (not only HUMOR editorial mode):
Humor may appear as a small natural moment inside non-humor posts when the situation itself has a laugh point.
Before including humor, reason:
1) Does the situation itself have room to smile?
2) Would the creator actually chuckle reading this?
3) Does humor damage Core Thought?
4) Does humor make understanding harder?
5) Does humor force exaggeration or invented experience?
6) Is it funny even without forced ㅋㅋ?
If not a clear fit → omit humor. Never force ㅋㅋ or punchlines.

Humor is NOT the main engagement engine.
Order of goals: lower understanding barrier → create self-projection point → then, only if natural, humor can further lower social/comment cost.

OUTPUT diagnostics (per post, optional but preferred):
- style_register: short label (e.g. mixed, observation, eumseum, plain)
- style_reason: one short phrase why this register for this seed
- self_disclosure_used: true|false
- natural_humor_present: true|false
`;
}

export function softContextualStyleHint(input: {
  editorial_mode?: string;
  reaction_mechanism?: string;
  topic?: string;
}): ContextualStyleDecision {
  const mode = String(input.editorial_mode || "").toUpperCase();
  const mech = String(input.reaction_mechanism || "");
  const topic = String(input.topic || "").toUpperCase();

  let register_hint: StyleRegisterHint = "mixed";
  let self_disclosure_fit = false;
  let natural_humor_fit = false;
  let reason = "default mixed register inside Creator DNA";

  if (mode === "CASUAL_OBSERVATION" || mech === "life_pattern_expose") {
    register_hint = "observation";
    natural_humor_fit = true;
    reason = "observation rhythm; light humor only if situation earns it";
  } else if (mode === "INFORMATIVE" || mech === "evidence_judgment") {
    register_hint = "explanatory";
    reason = "clear explanation without report polish";
  } else if (mode === "OPINION" || mech === "surprise_debate_shift") {
    register_hint = "plain";
    reason = "plain stance space; avoid lecture tone";
  } else if (mech === "everyday_blank_fill") {
    register_hint = "conversational";
    reason = "low barrier conversational; leave blank for reader";
  } else if (mech === "self_deprecating_open" || mech === "experience_empathy") {
    register_hint = "self_deprecating";
    self_disclosure_fit = true;
    natural_humor_fit = true;
    reason = "self-open if grounded; humor only if natural";
  } else if (mode === "EXPERIENCE") {
    register_hint = "experience_narration";
    self_disclosure_fit = true;
    reason = "experience narration only with evidence — no invention";
  }

  if (/CYBERTRUCK|FSD|OPTIMUS|TERAFAB/.test(topic) && register_hint === "mixed") {
    reason = "topic-neutral mixed; style from situation not niche jargon";
  }

  return { register_hint, self_disclosure_fit, natural_humor_fit, reason };
}
