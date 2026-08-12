/**
 * X Account Growth OS v10 — ORDER 4
 * Reader Story Invitation Judge
 *
 * Evaluates whether a post invites the reader to open their own story.
 * Does NOT score by presence of questions or CTA.
 * Soft offline heuristics + prompt instructions for model-side judgment.
 */

export type ReaderStoryJudgeScores = {
  everyday_language_fit: number | null;
  immediate_comprehension: number | null;
  self_projection_potential: number | null;
  reader_story_invitation: number | null;
  participation_barrier: number | null;
  reaction_mechanism_fit: number | null;
  creator_fit: number | null;
  natural_humor_fit: number | null;
  ai_tone_risk: number | null;
  over_explanation_risk: number | null;
  mechanism_repetition_risk: number | null;
  style_repetition_risk: number | null;
  reader_story_score: number | null;
  pass: boolean | null;
  notes: string[];
};

export function buildReaderStoryJudgeInstructions(): string {
  return `
READER STORY INVITATION JUDGE (v10 ORDER 4 — final quality gate):

Core questions (must reason, not check for CTA):
1) After reading, can the reader naturally recall a similar experience, memory, opinion, person, habit, or personal example from their life?
2) Is the psychological and knowledge cost of putting that story in a reply low?

Score dimensions (each 1–10 where useful; leave null if unknown):
- everyday_language_fit
- immediate_comprehension
- self_projection_potential
- reader_story_invitation
- participation_barrier (10 = very low barrier to reply)
- reaction_mechanism_fit
- creator_fit
- natural_humor_fit (only if humor present; else N/A)
- ai_tone_risk (10 = heavily AI/report tone)
- over_explanation_risk (10 = no room left for reader interpretation)
- mechanism_repetition_risk / style_repetition_risk when recent history is known

Hard principles:
- Do NOT deduct for missing question marks
- Do NOT deduct for missing CTA / comment requests
- Good posts open a door without asking for comments
- Judge the door, not the request to walk through it

Comment-friendly mechanisms (blank-fill, self-open, experience empathy):
- Can the reader supply a one- or two-word personal case?
- Did the writer open the atmosphere first?
- Does it demand a perfect or expert answer? (should not)

OUTPUT per post (preferred):
- reader_story_invitation: 1–10
- participation_barrier: 1–10 (higher = easier to reply)
- reader_story_score: 1–10 composite
- reader_story_pass: true|false
- reader_story_notes: short string or null
`;
}

export function softReaderStoryJudge(input: {
  content: string;
  reaction_mechanism?: string | null;
  everyday_language_clear?: boolean | null;
  natural_humor_present?: boolean | null;
  recent_mechanisms?: string[];
  recent_style_registers?: string[];
  style_register?: string | null;
}): ReaderStoryJudgeScores {
  const t = String(input.content || "").trim();
  const notes: string[] = [];
  if (!t) return emptyScores(["empty_content"]);

  const len = t.length;
  const sentences = (t.match(/[.。!?？!~]/g) || []).length;
  const over_explanation_risk =
    len > 900 || (len > 500 && sentences >= 12) ? 7 : len > 400 ? 4 : 2;

  const aiHits =
    (/결론적으로|요약하면|다음과 같습니다|핵심은 다음과|전반적으로 볼 때/.test(t) ? 1 : 0) +
    (/In conclusion|Furthermore|It is important to note/.test(t) ? 1 : 0);
  const ai_tone_risk = Math.min(10, 2 + aiHits * 3 + (over_explanation_risk >= 7 ? 2 : 0));

  const acronyms = (t.match(/\b[A-Z]{2,6}\b/g) || []).length;
  const everyday_language_fit =
    input.everyday_language_clear === false
      ? 4
      : acronyms >= 4
        ? 5
        : input.everyday_language_clear === true
          ? 8
          : 7;

  const hasLivedAnchor =
    /돈|시간|출근|운전|습관|실수|기다|사람|친구|가족|가격|비용|하루|요즘|처음/.test(t);
  const hasQuestion = /[?？]/.test(t);
  let self_projection_potential = hasLivedAnchor ? 7 : 5;
  let reader_story_invitation = hasLivedAnchor ? 7 : 5;
  if (hasQuestion) {
    reader_story_invitation = Math.min(10, reader_story_invitation + 1);
    notes.push("optional_question_present");
  } else {
    notes.push("no_cta_required");
  }

  let participation_barrier = 8;
  if (acronyms >= 4) participation_barrier -= 2;
  if (len > 700) participation_barrier -= 2;
  if (over_explanation_risk >= 7) participation_barrier -= 2;
  participation_barrier = Math.max(1, Math.min(10, participation_barrier));

  const mech = String(input.reaction_mechanism || "");
  let reaction_mechanism_fit = mech ? 7 : 5;
  if (/everyday_blank_fill|self_deprecating|experience_empathy|life_pattern/.test(mech)) {
    reaction_mechanism_fit = 8;
    reader_story_invitation = Math.min(10, reader_story_invitation + 1);
  }

  const recentM = input.recent_mechanisms || [];
  const recentS = input.recent_style_registers || [];
  let mechanism_repetition_risk = 2;
  let style_repetition_risk = 2;
  if (mech && recentM.filter((x) => x === mech).length >= 3) {
    mechanism_repetition_risk = 7;
    notes.push("mechanism_repeat_soft");
  }
  const reg = String(input.style_register || "");
  if (reg && recentS.filter((x) => x === reg).length >= 3) {
    style_repetition_risk = 7;
    notes.push("style_repeat_soft");
  }

  const natural_humor_fit = input.natural_humor_present ? 7 : null;
  const raw =
    reader_story_invitation * 0.35 +
    participation_barrier * 0.25 +
    everyday_language_fit * 0.2 +
    self_projection_potential * 0.15 +
    (10 - Math.min(10, ai_tone_risk)) * 0.05;
  const reader_story_score = Math.round(Math.max(1, Math.min(10, raw)) * 10) / 10;

  const pass =
    reader_story_score >= 6.5 &&
    participation_barrier >= 5 &&
    ai_tone_risk <= 7 &&
    over_explanation_risk <= 8;
  if (!pass) notes.push("below_invitation_threshold");

  return {
    everyday_language_fit,
    immediate_comprehension: everyday_language_fit,
    self_projection_potential,
    reader_story_invitation,
    participation_barrier,
    reaction_mechanism_fit,
    creator_fit: 7,
    natural_humor_fit,
    ai_tone_risk,
    over_explanation_risk,
    mechanism_repetition_risk,
    style_repetition_risk,
    reader_story_score,
    pass,
    notes,
  };
}

function emptyScores(notes: string[]): ReaderStoryJudgeScores {
  return {
    everyday_language_fit: null,
    immediate_comprehension: null,
    self_projection_potential: null,
    reader_story_invitation: null,
    participation_barrier: null,
    reaction_mechanism_fit: null,
    creator_fit: null,
    natural_humor_fit: null,
    ai_tone_risk: null,
    over_explanation_risk: null,
    mechanism_repetition_risk: null,
    style_repetition_risk: null,
    reader_story_score: null,
    pass: null,
    notes,
  };
}
