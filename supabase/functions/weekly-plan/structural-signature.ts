/**
 * Week-level structural signatures. Abstract only — never prior post wording.
 * Writer uses these as variety constraints. Judge uses them as a hard REJECT.
 */
export type WeekStructuralSignature = {
  hook_type: string;
  discourse_shape: string;
  ending_type: string;
  contrast_used: boolean;
  punchline_used: boolean;
  question_used: boolean;
  first_person_used: boolean;
  opening_type: string;
  paragraph_count: number;
  length_bucket: string;
  macro_conclusion_used: boolean;
};

/** 관찰→반전→재해석 — the AI unfold that must not accumulate in a week. */
export const DISCOURSE_TWIST_REINTERPRET = "observation_twist_reinterpret";

const MACRO_CONCLUSION = [
  /결국\s*중요한\s*것/,
  /시사하는\s*바가\s*큽/,
  /결론적으로/,
  /요약하면/,
];

export function inferHookType(text: string): string {
  const head = String(text || "").trim().slice(0, 28);
  if (!head) return "empty";
  if (/\?/.test(head)) return "question";
  if (/^\d/.test(head) || /\d/.test(head.slice(0, 12))) return "number_lead";
  if (/내가|제가/.test(head)) return "first_person_scene";
  if (/그런데|하지만|반대로|오히려/.test(head)) return "contrast";
  return "situation";
}

export function inferDiscourseShape(text: string): string {
  const t = String(text || "");
  const twist = /그런데|하지만|반대로|오히려/.test(t);
  const reinterp = /다시 보면|다시 생각|그래서인지|결국에는|결국 /.test(t);
  if (twist && reinterp) return DISCOURSE_TWIST_REINTERPRET;
  if (twist) return "observation_twist";
  if (/내가|제가/.test(t) && /그때|어제|오늘/.test(t)) return "lived_scene";
  if (/그래서|결국/.test(t)) return "consequence";
  if (/해야|무조건|틀린|맞다/.test(t.slice(0, 48))) return "judgment_first";
  return "situation_only";
}

export function extractStructuralSignature(text: string): WeekStructuralSignature {
  const lines = String(text || "").split(/\n/).filter((l) => l.trim().length > 0);
  const hasQ = /\?/.test(text);
  const hasPunch = /ㅋㅋ|ㅎㅎ|ㅋ\s*$/.test(text);
  const firstPerson = /제가|나는|제가\s|우리\s/.test(text);
  const opening = lines[0]?.slice(0, 24) || "";
  return {
    hook_type: inferHookType(text),
    discourse_shape: inferDiscourseShape(text),
    paragraph_count: lines.length,
    opening_type: opening.length > 0 ? (hasQ && lines.length === 1 ? "question" : "statement") : "empty",
    ending_type: hasPunch ? "humor_tail" : hasQ ? "question" : "statement",
    question_used: hasQ,
    punchline_used: hasPunch,
    first_person_used: firstPerson,
    contrast_used: /그런데|하지만|반대로|오히려/.test(text),
    macro_conclusion_used: MACRO_CONCLUSION.some((re) => re.test(text)),
    length_bucket: text.length < 80 ? "S" : text.length < 180 ? "M" : "L",
  };
}

/** Hard-fail reasons when this post repeats the week's hook / unfold / ending. */
export function weekStructureHardReasons(
  mine: WeekStructuralSignature,
  others: Array<Record<string, unknown>>,
): string[] {
  const hard: string[] = [];
  const prior = (others || []).filter((s) => s && typeof s === "object");
  for (const sig of prior) {
    if (
      sig.hook_type === mine.hook_type &&
      sig.discourse_shape === mine.discourse_shape &&
      sig.ending_type === mine.ending_type
    ) {
      hard.push("structural_repetition_high");
      break;
    }
  }
  const sameShape = prior.filter((s) => s.discourse_shape === mine.discourse_shape).length;
  if (mine.discourse_shape === DISCOURSE_TWIST_REINTERPRET && sameShape >= 1) {
    hard.push("structural_repetition_high");
  } else if (sameShape >= 2) {
    hard.push("structural_repetition_high");
  }
  return [...new Set(hard)];
}

export function writerWeekStructureConstraintLines(
  signatures: Array<Record<string, unknown>> | null | undefined,
): string[] {
  const prior = (signatures || []).filter((s) => s && typeof s === "object");
  if (prior.length === 0) {
    return [
      "WEEK STRUCTURE SIGNAL: first post in this seven-day set.",
    ];
  }
  const shapes = prior.map((s) => String(s.discourse_shape || "")).filter(Boolean);
  const hooks = prior.map((s) => String(s.hook_type || "")).filter(Boolean);
  const endings = prior.map((s) => String(s.ending_type || "")).filter(Boolean);
  const usedTwist = shapes.includes(DISCOURSE_TWIST_REINTERPRET);
  return [
    "WEEK STRUCTURE (abstract only — not sentences to copy):",
    "Already used discourse shapes: " + [...new Set(shapes)].join(", "),
    "Already used hooks: " + [...new Set(hooks)].join(", "),
    "Already used endings: " + [...new Set(endings)].join(", "),
    usedTwist
      ? "FORBIDDEN this slot: 관찰→반전→재해석. That unfold was already used this week."
      : "Do not default to 관찰→반전→재해석. Vary how the observation unfolds.",
    "Do not repeat the same hook + unfold + ending combination.",
  ];
}
