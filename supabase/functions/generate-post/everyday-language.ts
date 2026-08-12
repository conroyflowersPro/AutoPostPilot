/**
 * X Account Growth OS v10 — ORDER 2
 * Everyday Language + Low Participation Barrier
 *
 * Top-level principle applied across ALL Reaction Mechanisms.
 * NOT a replacement dictionary. NOT dumbing down thought.
 * Re-express meaning in words people actually use in daily life.
 */

/** Soft diagnostic only — never used as a static rewrite dictionary */
export type EverydayLanguageCheck = {
  /** true if a non-expert could grasp the first 1–2 sentences without search */
  first_pass_clear: boolean | null;
  /** short note when re-expression was needed; null when already everyday */
  rewrite_note: string | null;
};

/**
 * Prompt fragment: reason about meaning first, then everyday speech.
 * Explicitly bans static term→phrase dictionaries.
 */
export function buildEverydayLanguageInstructions(): string {
  return `
EVERYDAY LANGUAGE (v10 ORDER 2 — top-level, applies to every Reaction Mechanism):

Philosophy:
- Do NOT lower the level of thought.
- Do NOT strip expertise or facts.
- DO lower the language barrier.
- Hard ideas stay hard; the words must sound like spoken daily Korean.

Reasoning first (internal — do this before final wording):
1) If explaining this idea out loud to a friend, which words would I actually say?
2) Can someone outside this industry understand the first sentence?
3) Is the word I am about to use common in ordinary conversation?
4) Would the reader need to search to understand this term?
5) Is there a shorter, plainer way to carry the same meaning?
6) After simplifying language, is the original meaning intact?
7) Can this connect naturally to everyday experience (waiting, driving, money, time, habits, teaching someone, learning a new thing, friends/family, ordinary choices) — without forced metaphor?

Critical bans:
- NO static replacement dictionary (e.g. never auto-map "E2E" → "처음부터 끝까지").
- Understand the concept, then re-express the whole idea in lived language.
- Do not invent facts while simplifying.
- Do not talk down to the reader or sound childish.
- Reader baseline for early growth: a guest who does not know this field — explain as you would to them in person, casually and clearly.

Goal chain (why this matters for growth):
easy understanding → connect to own experience → find a reaction point → easier to share a short self-story

Final gate before content is done:
"Could a ordinary person who knows nothing about this topic understand what this post is saying on first read?"
If NO → re-express. Do not invent new meaning or facts.

OUTPUT (optional diagnostics per post):
- everyday_language_clear: true | false | null
- everyday_rewrite_note: short note or null
`;
}

/**
 * Soft heuristic only for offline checks / optional post-process notes.
 * Does NOT rewrite content. Does NOT maintain a jargon dictionary.
 */
export function softEverydayClarityHint(text: string): EverydayLanguageCheck {
  const t = String(text || "").trim();
  if (!t) {
    return { first_pass_clear: null, rewrite_note: null };
  }
  // Signal only: dense Latin acronym clusters often need lived re-expression
  const acronymHits = t.match(/\b[A-Z]{2,6}\b/g) || [];
  const denseTech =
    acronymHits.length >= 3 ||
    /엔드투엔드|레이턴시|쓰루풋|추론 서버|온디바이스/.test(t);

  if (denseTech) {
    return {
      first_pass_clear: false,
      rewrite_note: "dense_tech_surface — re-express meaning in spoken daily words without dictionary swap",
    };
  }
  return { first_pass_clear: true, rewrite_note: null };
}
