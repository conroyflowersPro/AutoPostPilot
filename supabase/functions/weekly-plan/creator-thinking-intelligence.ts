/**
 * ORDER 2 — Creator Thinking Intelligence for Agent승 THINK.
 *
 * A Thinking Rail is not a writing structure. It is abstracted thinking
 * behavior from actual Creator publishing. Static ABSTRACT_RAIL_LIBRARY is
 * generic reference only — never presented as this user's mind.
 *
 * Retrieval is situation/constraint/tension/scale, not Topic name.
 * No Rail is a normal outcome. Do not raise rail usage.
 */
import type { SemanticSeedPacket } from "./semantic-seed-packet.ts";

export const CREATOR_THINKING_INTELLIGENCE_VERSION = "creator_thinking_intelligence_v1";
export const STATIC_RAIL_IS_NOT_CREATOR_DNA = true as const;
export const NO_RAIL_IS_NORMAL = true as const;
export const THINKING_RETRIEVAL_MAX = 3 as const;
/** Default matches thinking_extract_jobs.recent_14d_weight — applied, not dead config. */
export const DEFAULT_RECENT_14D_WEIGHT = 2 as const;

export type ThinkingCandidateRow = {
  id?: string;
  rail_key?: string | null;
  topic?: string | null;
  editorial_modes?: string[] | null;
  trigger_summary?: string | null;
  expansion_steps?: unknown;
  support_count?: number | null;
  recent_14d_support?: number | null;
  recent_usage?: string | null;
  historical_strength?: string | null;
  confidence?: number | null;
  status?: string | null;
  notes?: string | null;
  reasoning_actions?: unknown;
  scale_movement?: string | null;
  judgment_tendency?: string | null;
  incompatibility?: string | null;
  recent_14d_weight?: number | null;
};

export type RetrievedThinkingPattern = {
  id: string;
  source: "creator_evidence";
  trigger_condition?: string;
  reasoning_behaviors: string[];
  optional_movements: string[];
  scale_movement?: string;
  judgment_tendency?: string;
  incompatibility?: string;
  support_count: number;
  recent_14d_support: number;
  weighted_score: number;
};

export type ThinkingIntelligence = {
  version: string;
  source: "creator_evidence" | "none";
  none_is_normal: true;
  static_library_is_not_creator_dna: true;
  patterns: RetrievedThinkingPattern[];
};

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "then",
  "그", "이", "저", "것", "수", "등", "및", "또는", "하다", "있다", "없다",
]);

/** Product/topic tokens must not decide retrieval. Not a Topic→Rail map. */
const TOPICISH = /^(tesla|fsd|cybertruck|optimus|robotaxi|elon|musk|xai|grok|lafc|nvidia|spacex|테슬라|사이버트럭|옵티머스|로보택시|그록)$/i;

function s(v: unknown, max = 180): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => s(x, 80)).filter((x) => x.length >= 2).slice(0, 8);
  const t = s(v, 240);
  if (!t) return [];
  return t.split(/[>,;/|]/).map((x) => s(x, 80)).filter((x) => x.length >= 2).slice(0, 8);
}

function meaningTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of s(text, 400).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 2) continue;
    if (STOP.has(w)) continue;
    if (TOPICISH.test(w)) continue;
    out.add(w);
  }
  return out;
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

function situationBlob(
  packet: SemanticSeedPacket | null | undefined,
  interp: Record<string, unknown> | null | undefined,
): string {
  const p = packet || {};
  const ip = interp || {};
  return [
    p.scene,
    p.factual_event,
    p.change_or_delta,
    p.contrast_or_tension,
    p.human_relevance,
    ip.what_is_actually_happening,
    ip.what_is_new_or_interesting,
    ip.possible_reader_connection,
    ip.why_it_might_matter_to_creator,
  ]
    .map((x) => s(x, 180))
    .filter(Boolean)
    .join(" ");
}

function candidateBlob(row: ThinkingCandidateRow): string {
  let notesExtra = "";
  try {
    const n = JSON.parse(String(row.notes || ""));
    if (n && typeof n === "object") {
      notesExtra = [n.judgment_tendency, n.scale_movement, n.ending_tendency, n.aggregation]
        .map((x) => s(x, 80))
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    notesExtra = s(row.notes, 180);
  }
  return [
    row.trigger_summary,
    asList(row.expansion_steps).join(" "),
    asList(row.reasoning_actions).join(" "),
    row.scale_movement,
    row.judgment_tendency,
    notesExtra,
    row.incompatibility,
  ]
    .map((x) => s(x, 180))
    .filter(Boolean)
    .join(" ");
}

function historicalNorm(row: ThinkingCandidateRow): number {
  const label = s(row.historical_strength).toUpperCase();
  if (label === "HIGH") return 1;
  if (label === "MEDIUM") return 0.6;
  const support = Number(row.support_count) || 0;
  if (support >= 5) return 1;
  if (support >= 3) return 0.6;
  if (support >= 2) return 0.35;
  return 0.15;
}

/**
 * Recent 14d is a weight, not an overwrite of long-term thinking.
 * recent_14d_weight from extract jobs is applied here.
 */
export function weightedThinkingScore(
  overlap: number,
  row: ThinkingCandidateRow,
  recent14dWeight = DEFAULT_RECENT_14D_WEIGHT,
): number {
  const support = Math.max(0, Number(row.support_count) || 0);
  const recent = Math.max(0, Number(row.recent_14d_support) || 0);
  const recentRatio = support > 0 ? Math.min(1, recent / support) : 0;
  const hist = historicalNorm(row);
  const w = Number.isFinite(Number(recent14dWeight)) ? Number(recent14dWeight) : DEFAULT_RECENT_14D_WEIGHT;
  const recentBoost = Math.min(1.2, recentRatio * w * 0.25);
  return overlap * (0.7 + 0.3 * hist) + recentBoost;
}

export function retrieveCreatorThinkingIntelligence(input: {
  candidates?: ThinkingCandidateRow[] | null;
  seed_packet?: SemanticSeedPacket | null;
  interpretation?: Record<string, unknown> | null;
  recent_14d_weight?: number | null;
  limit?: number;
}): ThinkingIntelligence {
  const empty: ThinkingIntelligence = {
    version: CREATOR_THINKING_INTELLIGENCE_VERSION,
    source: "none",
    none_is_normal: true,
    static_library_is_not_creator_dna: true,
    patterns: [],
  };
  const rows = (input.candidates || []).filter((r) => {
    const st = s(r.status).toUpperCase();
    if (st === "REJECTED") return false;
    return (Number(r.support_count) || 0) >= 2 || (Number(r.confidence) || 0) >= 0.5;
  });
  if (!rows.length) return empty;

  const sit = meaningTokens(situationBlob(input.seed_packet, input.interpretation));
  if (sit.size === 0) return empty;

  const weight = input.recent_14d_weight ?? DEFAULT_RECENT_14D_WEIGHT;
  const scored = rows
    .map((row) => {
      const ov = overlapCount(sit, meaningTokens(candidateBlob(row)));
      return { row, overlap: ov, score: weightedThinkingScore(ov, row, weight) };
    })
    .filter((x) => x.overlap >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? THINKING_RETRIEVAL_MAX);

  if (!scored.length) return empty;

  const patterns: RetrievedThinkingPattern[] = scored.map((x, i) => {
    let noteObj: Record<string, unknown> = {};
    try {
      const n = JSON.parse(String(x.row.notes || ""));
      if (n && typeof n === "object") noteObj = n as Record<string, unknown>;
    } catch {
      noteObj = {};
    }
    const actions = asList(x.row.reasoning_actions?.length ? x.row.reasoning_actions : x.row.expansion_steps);
    const trigger = s(x.row.trigger_summary, 140);
    const scale = s(x.row.scale_movement || noteObj.scale_movement, 80);
    const judge = s(x.row.judgment_tendency || noteObj.judgment_tendency, 80);
    const incompat = s(x.row.incompatibility || noteObj.incompatibility, 80);
    return {
      id: s(x.row.id || x.row.rail_key || `pattern_${i + 1}`, 80) || `pattern_${i + 1}`,
      source: "creator_evidence",
      trigger_condition: trigger || undefined,
      reasoning_behaviors: actions,
      optional_movements: [],
      scale_movement: scale || undefined,
      judgment_tendency: judge || undefined,
      incompatibility: incompat || undefined,
      support_count: Number(x.row.support_count) || 0,
      recent_14d_support: Number(x.row.recent_14d_support) || 0,
      weighted_score: Number(x.score.toFixed(3)),
    };
  });

  return {
    version: CREATOR_THINKING_INTELLIGENCE_VERSION,
    source: "creator_evidence",
    none_is_normal: true,
    static_library_is_not_creator_dna: true,
    patterns,
  };
}

export function thinkingIntelligenceLines(intel: ThinkingIntelligence | null | undefined): string[] {
  const none = [
    "CREATOR THINKING INTELLIGENCE: none for this situation. No Rail is normal.",
    "Static generic rails are not this Creator's thinking DNA. Do not treat them as 사용자의 사고방식.",
    "You may invent a new thinking path from this seed, or stay with a small observation. Rail usage is not a goal.",
  ];
  if (!intel || !intel.patterns.length) return none;
  const lines = [
    "CREATOR THINKING INTELLIGENCE (reference only — not a post template, not Core Thought):",
    "You may use one pattern, parts of several, mutate, invent a new path, or use none. No Rail is normal.",
    "Do not copy surface style (존댓말, 반말, ㅋㅋ, 음슴체, hook, punchline, sentence length). That is Voice.",
  ];
  for (const p of intel.patterns) {
    const bits = [
      p.trigger_condition ? "trigger: " + p.trigger_condition : "",
      p.reasoning_behaviors.length ? "actions: " + p.reasoning_behaviors.join(", ") : "",
      p.scale_movement ? "scale: " + p.scale_movement : "",
      p.judgment_tendency ? "judgment: " + p.judgment_tendency : "",
      p.incompatibility ? "avoid: " + p.incompatibility : "",
    ].filter(Boolean);
    if (bits.length) lines.push("- " + bits.join(" · "));
  }
  return lines;
}

export function emptyThinkingIntelligence(): ThinkingIntelligence {
  return {
    version: CREATOR_THINKING_INTELLIGENCE_VERSION,
    source: "none",
    none_is_normal: true,
    static_library_is_not_creator_dna: true,
    patterns: [],
  };
}
