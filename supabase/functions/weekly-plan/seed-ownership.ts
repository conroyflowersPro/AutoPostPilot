/**
 * Seed ownership and lived-time rules.
 * Rules only — no frozen scenes, interest lists, or example posts.
 */
export type SeedSourceKind = "PUBLIC_X" | "ANALYTICS_LIVED";
export type SeedOwner = "OTHER" | "SELF";
export type FoundForm = "EXPERIENTIAL" | "OTHER";
export type LivedTimePhrase = "omit" | "day_before" | "within_week" | "older";

export function seedOwnerOf(seed: Record<string, unknown> | null | undefined): SeedOwner {
  const raw = String(seed?.owner || seed?.seed_owner || "").toUpperCase();
  if (raw === "SELF") return "SELF";
  if (raw === "OTHER") return "OTHER";
  if (String(seed?.source || seed?.seed_source || "").toUpperCase() === "ANALYTICS_LIVED") return "SELF";
  return "OTHER";
}

export function isLivedSelfSeed(seed: Record<string, unknown> | null | undefined): boolean {
  return seedOwnerOf(seed) === "SELF";
}

export function isPublicOtherSeed(seed: Record<string, unknown> | null | undefined): boolean {
  return seedOwnerOf(seed) === "OTHER";
}

function ymdInLosAngeles(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayDiffYmd(later: string, earlier: string): number {
  if (!later || !earlier) return 999;
  const a = Date.parse(`${earlier}T12:00:00-07:00`);
  const b = Date.parse(`${later}T12:00:00-07:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 999;
  return Math.round((b - a) / 86400000);
}

/** Recency bound only. Writer infers Korean wording. Never a canned calendar word. Never N일 전. */
export function livedTimePhrase(occurredAt: string | undefined, now: Date = new Date()): LivedTimePhrase {
  const occurred = occurredAt ? ymdInLosAngeles(occurredAt) : "";
  const today = ymdInLosAngeles(now);
  const diff = dayDiffYmd(today, occurred);
  if (diff === 1) return "day_before";
  if (diff >= 2 && diff <= 7) return "within_week";
  if (diff > 7) return "older";
  return "omit";
}

export function writerLivedTimeLines(occurredAt: string | undefined, now: Date = new Date()): string[] {
  const phrase = livedTimePhrase(occurredAt, now);
  const infer =
    "Infer Korean recency from this bound. Do not copy a time-word from this prompt. Do not write N일 전.";
  if (phrase === "day_before") {
    return [`LIVED TIME BOUND: previous calendar day in America/Los_Angeles. ${infer}`];
  }
  if (phrase === "within_week") {
    return [`LIVED TIME BOUND: a few days before now, still inside the past week. ${infer}`];
  }
  if (phrase === "older") {
    return [`LIVED TIME BOUND: older than a week. Infer as past, not this week. ${infer}`];
  }
  return [`LIVED TIME BOUND: no dated recency. ${infer}`];
}

export function hasForbiddenDayCountPhrase(text: string): boolean {
  return /\d+\s*일\s*전/.test(String(text || ""));
}

export function inhabitsOtherLivedViral(text: string): boolean {
  const t = String(text || "");
  return /어제\s*내가|어제\s*내\s|저번주\s*내|예전에\s*내가\s*(직접|당했|식겁)/.test(t);
}

export function sortLivedNewestFirst<T extends { occurred_at?: string; published_at?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(String(a.occurred_at || a.published_at || 0)) || 0;
    const tb = Date.parse(String(b.occurred_at || b.published_at || 0)) || 0;
    return tb - ta;
  });
}

export function publicSearchWindows(now: Date = new Date()): {
  last7: { from: string; to: string; key: "last7" };
} {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const to = now;
  const from = new Date(now.getTime() - 7 * 86400000);
  return {
    last7: { from: iso(from), to: iso(to), key: "last7" },
  };
}

function livedClauses(text: string): string[] {
  return String(text || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…다요함음죠네])\s+|\n+/)
    .map((c) => c.replace(/^["'“”]+|["'“”]+$/g, "").trim())
    .filter((c) => c.length >= 10 && !/동일 내용|cite the lived|어떻게 생각|팔로우/i.test(c));
}

/** Scene / change meaning only. Never the original post. Never cluster+"실사용 후속". */
export function livedMeaningGist(text: string): string {
  const stripped = String(text || "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  if (stripped.length < 12) return "";
  const clauses = livedClauses(stripped);
  const picked = clauses.find((c) => c.length <= 72) || clauses[0] || stripped.slice(0, 72);
  let gist = picked.replace(/^(결국|사실|진짜|솔직히)\s*/i, "").trim().slice(0, 72);
  if (stripped.length > 90 && gist.length > stripped.length * 0.85) gist = gist.slice(0, 48);
  if (/실사용 후속/.test(gist)) return "";
  return gist.length >= 10 ? gist : "";
}

export function livedExperienceFacts(text: string): string[] {
  return livedClauses(text).map((c) => c.slice(0, 140)).slice(0, 4);
}

export function abstractLivedSubject(text: string, _cluster: string): string {
  return livedMeaningGist(text);
}

export function livedAsOf(
  occurredAt: string | undefined,
  now: Date = new Date(),
): { as_of: string; days_ago: number | null } {
  const occurred = occurredAt ? ymdInLosAngeles(occurredAt) : "";
  const today = ymdInLosAngeles(now);
  const diff = dayDiffYmd(today, occurred);
  if (!occurred || diff >= 900) return { as_of: "unknown", days_ago: null };
  if (diff <= 0) return { as_of: "today", days_ago: 0 };
  if (diff === 1) return { as_of: "yesterday", days_ago: 1 };
  return { as_of: `${diff}_days_ago`, days_ago: diff };
}

/** Same-cluster newer lived unused while an older lived was picked. Code does not swap — caller re-asks Agent승. */
export function staleLivedExperiencePicks(args: {
  slots: Array<{ slot_id: string; editorial_mode?: string }>;
  assignments: Array<{ slot_id: string; seed_id: string }>;
  pool: Array<Record<string, unknown>>;
}): string[] {
  const used = new Set(args.assignments.map((a) => String(a.seed_id || "")).filter(Boolean));
  const lived = sortLivedNewestFirst(args.pool.filter((s) => isLivedSelfSeed(s) && String(s.seed_id || "")));
  const fails: string[] = [];
  for (const slot of args.slots) {
    if (String(slot.editorial_mode || "").toUpperCase() !== "EXPERIENCE") continue;
    const pick = args.assignments.find((a) => a.slot_id === slot.slot_id);
    if (!pick) continue;
    const chosen = args.pool.find((s) => String(s.seed_id || "") === pick.seed_id);
    if (!chosen || !isLivedSelfSeed(chosen)) continue;
    const cluster = String(chosen.cluster || "");
    if (!cluster) continue;
    const chosenT = Date.parse(String(chosen.occurred_at || chosen.published_at || 0)) || 0;
    const newer = lived.find((s) => {
      const id = String(s.seed_id || "");
      if (!id || id === pick.seed_id) return false;
      if (used.has(id)) return false;
      if (String(s.cluster || "") !== cluster) return false;
      const t = Date.parse(String(s.occurred_at || s.published_at || 0)) || 0;
      return t > chosenT;
    });
    if (newer) fails.push(slot.slot_id);
  }
  return fails;
}

export type ExperienceAssignment = {
  slot_id: string;
  seed_id: string;
  planner_intent: string;
  editorial_mode: string;
};

export function applyNewestLivedExperienceAssignments(args: {
  slots: Array<{ slot_id: string; editorial_mode?: string; planner_intent?: string }>;
  assignments: ExperienceAssignment[];
  missing: Array<{ slot_id: string; exploration_direction: string }>;
  pool: Array<Record<string, unknown>>;
}): { assignments: ExperienceAssignment[]; missing: Array<{ slot_id: string; exploration_direction: string }> } {
  const lived = sortLivedNewestFirst(
    args.pool.filter((s) => isLivedSelfSeed(s) && String(s.seed_id || "")),
  );
  const expSlots = args.slots.filter((s) => String(s.editorial_mode || "").toUpperCase() === "EXPERIENCE");
  if (!expSlots.length) {
    return { assignments: args.assignments, missing: args.missing };
  }
  const used = new Set(
    args.assignments
      .filter((a) => !expSlots.some((s) => s.slot_id === a.slot_id))
      .map((a) => a.seed_id),
  );
  const bySlot = new Map(args.assignments.map((a) => [a.slot_id, a]));
  const missing = args.missing.filter((m) => !expSlots.some((s) => s.slot_id === m.slot_id));
  const assignments = args.assignments.filter((a) => !expSlots.some((s) => s.slot_id === a.slot_id));
  let i = 0;
  for (const slot of expSlots) {
    while (i < lived.length && used.has(String(lived[i].seed_id || ""))) i += 1;
    const seed = lived[i];
    const prev = bySlot.get(slot.slot_id);
    if (!seed) {
      missing.push({
        slot_id: slot.slot_id,
        exploration_direction: "EXPERIENCE",
      });
      continue;
    }
    i += 1;
    used.add(String(seed.seed_id));
    assignments.push({
      slot_id: slot.slot_id,
      seed_id: String(seed.seed_id),
      planner_intent: prev?.planner_intent || String(slot.planner_intent || "lived episode"),
      editorial_mode: "EXPERIENCE",
    });
  }
  return { assignments, missing };
}
