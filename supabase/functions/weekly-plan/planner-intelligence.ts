/**
 * Load latest Audience / Performance / Revenue DNA + Planner Memory for the 3-day Planner.
 * Missing rows are UNKNOWN / insufficient evidence — never treated as zero success.
 * Current X Context is currentness, not a news feed and not a post prompt.
 */
export type PlannerIntelligenceBlocks = {
  audience_dna: string;
  performance_learned: string;
  revenue_dna: string;
  planner_memory: string;
  current_x_context: string;
};

const UNKNOWN = "UNKNOWN / insufficient evidence";

function compact(v: unknown, max = 400): string {
  if (v == null) return "";
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim().slice(0, max);
  try {
    return JSON.stringify(v).slice(0, max);
  } catch {
    return "";
  }
}

async function latest(
  supabase: { from: (t: string) => any },
  table: string,
  columns: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !Array.isArray(data) || !data[0]) return null;
    return data[0] as Record<string, unknown>;
  } catch {
    return null;
  }
}

function audienceBlock(row: Record<string, unknown> | null): string {
  if (!row) {
    return `AUDIENCE DNA (current): ${UNKNOWN}. Primary source is X Analytics; Fedica is auxiliary. Do not invent interest. Do not overwrite Creator DNA. Do not chase popularity. INTEREST LADDER: ${UNKNOWN}. Do not promote a topic from one result.`;
  }
  const summary = compact(row.summary_ko, 220) || UNKNOWN;
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const ladder = Array.isArray(data.interestLadder) ? (data.interestLadder as Array<Record<string, unknown>>) : [];
  const ladderLine = ladder.length
    ? "INTEREST LADDER (repeat cycles only, one step): " +
      ladder
        .slice(0, 10)
        .map((e) => `${compact(e.topic, 24)}:${compact(e.stage, 16)}`)
        .join(" · ")
    : `INTEREST LADDER: ${UNKNOWN}. Do not promote from one post.`;
  const bits = [
    compact(data.summaryKo, 160),
    Array.isArray(data.interestGraph) ? `interests: ${(data.interestGraph as string[]).slice(0, 6).join(", ")}` : "",
    Array.isArray(data.topicMovement) ? `movement: ${(data.topicMovement as string[]).slice(0, 5).join(", ")}` : "",
    ladderLine,
  ].filter(Boolean);
  return [
    "AUDIENCE DNA (current, X Analytics primary, Fedica auxiliary):",
    summary,
    ...bits,
    "Use for Seed + editorial balance. Must not overwrite Creator DNA. Must not become popularity chasing.",
    "Promote Exploration → Emerging → Secondary → Core only after repeated follower/profile/bookmark/reply signals across cycles.",
  ].join("\n");
}

function performanceLearnedBlock(row: Record<string, unknown> | null): string {
  if (!row) {
    return `PERFORMANCE DNA (learned from Publishing+Analytics): ${UNKNOWN}. Do not invent success. Do not copy wording. Candidate window in engine rules is not validated.`;
  }
  const summary = compact(row.summary_ko, 220) || UNKNOWN;
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const why = Array.isArray(data.whyPatterns) ? (data.whyPatterns as string[]).slice(0, 6) : [];
  const topics = Array.isArray(data.topicWins) ? (data.topicWins as string[]).slice(0, 6) : [];
  return [
    "PERFORMANCE DNA (learned, published+analytics only):",
    summary,
    topics.length ? `topic pattern: ${topics.join("; ")}` : "",
    ...why.map((w) => `pattern: ${compact(w, 140)}`),
    "Decide which strategic patterns to try more or less. Never copy a sentence. Must not overwrite Creator DNA.",
  ].filter(Boolean).join("\n");
}

function revenueBlock(row: Record<string, unknown> | null): string {
  if (!row) {
    return `REVENUE DNA (current): ${UNKNOWN}. Do not treat empty revenue as a success pattern. Must not dominate Planner or outrank authenticity/trust.`;
  }
  const summary = compact(row.summary_ko, 220) || UNKNOWN;
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const byTopic = Array.isArray(data.revenueByTopic) ? (data.revenueByTopic as string[]).slice(0, 6) : [];
  const notes = Array.isArray(data.notes) ? (data.notes as string[]).slice(0, 4) : [];
  return [
    "REVENUE DNA (current):",
    summary,
    ...byTopic.map((t) => `by_topic: ${compact(t, 80)}`),
    ...notes.map((n) => compact(n, 120)),
    "Profitable direction is information only. Do not repeat a topic only because it paid. Do not outrank authenticity, audience quality, trust.",
  ].filter(Boolean).join("\n");
}

function memoryBlock(row: Record<string, unknown> | null): string {
  if (!row) {
    return `PLANNER MEMORY: ${UNKNOWN}. Generated drafts are hypotheses. Only published+analytics patterns belong here.`;
  }
  const summary = compact(row.summary_ko, 220) || UNKNOWN;
  const patterns = Array.isArray(row.patterns) ? (row.patterns as string[]).slice(0, 8) : [];
  return [
    "PLANNER MEMORY (validated abstract patterns only):",
    summary,
    ...patterns.map((p) => `memory: ${compact(p, 160)}`),
    "Apply as strategy. Never reuse wording. Unpublished AI drafts are not memory.",
  ].join("\n");
}

export function currentXContextBlock(recentAngles?: string[]): string {
  const angles = (recentAngles || []).map((a) => compact(a, 40)).filter(Boolean).slice(0, 8);
  return [
    "CURRENT X CONTEXT: currentness for Planner. Not a news feed. Do not copy this block into a post prompt.",
    angles.length
      ? `Recent published flow (this account's conversation, not X-wide news): ${angles.join(" · ")}`
      : `Live X events / official announcements: ${UNKNOWN}. Do not invent news or debates.`,
    "Judge why-this-subject-now. Separate short-term noise from seed-worthy change. Creator authentic events stay valid even if X is quiet.",
  ].join("\n");
}

export async function loadPlannerIntelligence(
  supabase: { from: (t: string) => any } | null | undefined,
  recentAngles?: string[],
): Promise<PlannerIntelligenceBlocks> {
  if (!supabase) {
    return {
      audience_dna: audienceBlock(null),
      performance_learned: performanceLearnedBlock(null),
      revenue_dna: revenueBlock(null),
      planner_memory: memoryBlock(null),
      current_x_context: currentXContextBlock(recentAngles),
    };
  }
  const [audience, performance, revenue, memory] = await Promise.all([
    latest(supabase, "audience_dna", "summary_ko, data, created_at"),
    latest(supabase, "performance_dna", "summary_ko, data, created_at"),
    latest(supabase, "revenue_dna", "summary_ko, data, created_at"),
    latest(supabase, "planner_memory", "summary_ko, patterns, created_at"),
  ]);
  return {
    audience_dna: audienceBlock(audience),
    performance_learned: performanceLearnedBlock(performance),
    revenue_dna: revenueBlock(revenue),
    planner_memory: memoryBlock(memory),
    current_x_context: currentXContextBlock(recentAngles),
  };
}
