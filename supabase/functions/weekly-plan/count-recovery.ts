/**
 * ORDER 0A HOTFIX 3 — Dynamic shortfall recovery (no angle-variant clones, no fixed refill).
 * Every cycle recomputes shortfall vs planner canonical minimum.
 * Recovery candidates must pass the same diversity/safety gates as normal seeds.
 */

import {
  applyLocalGates,
  bootstrapCandidatesFromDimensions,
  canServeEditorialMode,
  conceptualRepetitionLevel,
  createSeedIdFactory,
  ideaAngleGuardAllow,
  ideaAngleKey,
  isSelectableStatus,
  subjectSignature,
  type ConcreteSeed,
} from "./seed-engine.ts";

export type ReplacementRecord = {
  original_slot_id?: string;
  replacement_slot_id: string;
  replacement_reason:
    | "EXPAND_SHORTFALL"
    | "SELECT_SHORTFALL"
    | "GENERATION_FAILURE"
    | "PARSER_FAILURE"
    | "JUDGE_REJECTION"
    | "PERSISTENCE_FAILURE";
  source_stage: "expand" | "select" | "generate" | "persist";
  retry_number: number;
};

export type ExpandRecoveryResult = {
  candidates: any[];
  recovered: number;
  shortfall_before: number;
  shortfall_after: number;
  canonical_target: number;
  sources_used: string[];
  cycles: number;
  replacements: ReplacementRecord[];
  target_met: boolean;
  rejected_as_near_duplicate: number;
};

export type SelectRecoveryResult = {
  days: Array<{ dayOffset: number; posts: any[] }>;
  recovered: number;
  shortfall_before: number;
  shortfall_after: number;
  canonical_target: number;
  cycles: number;
  need_expand_again: boolean;
  expand_request_count: number;
  replacements: ReplacementRecord[];
  target_met: boolean;
};

const MAX_EXPAND_CYCLES = 10;
const MAX_SELECT_CYCLES = 16;

export function computeShortfall(canonical: number, current: number): number {
  return Math.max(0, (Number(canonical) || 0) - Math.max(0, Number(current) || 0));
}

/** Reject near-duplicate meaning (same angle key / high similarity). */
export function isMeaningfulDistinct(
  candidate: Partial<ConcreteSeed>,
  existing: Array<Partial<ConcreteSeed>>
): boolean {
  if (!existing.length) return true;
  if (conceptualRepetitionLevel(candidate, existing) === "HIGH") return false;
  const guard = ideaAngleGuardAllow(candidate, existing, { softSecond: false });
  if (!guard.allow) return false;
  const ck = ideaAngleKey(candidate);
  for (const e of existing) {
    if (ideaAngleKey(e) === ck) return false;
    const a = subjectSignature(String(candidate.concrete_subject || ""));
    const b = subjectSignature(String(e.concrete_subject || ""));
    if (a && b && (a === b || a.includes(b) || b.includes(a))) {
      if (Math.min(a.length, b.length) >= 16) return false;
    }
  }
  return true;
}

function ingestDistinct(
  out: any[],
  seen: Set<string>,
  list: any[],
  source: string,
  sources_used: string[]
): { added: number; rejected_dup: number } {
  let added = 0;
  let rejected_dup = 0;
  for (const c of list) {
    const sig = subjectSignature(String(c.concrete_subject || ""));
    if (!sig || seen.has(sig)) {
      rejected_dup++;
      continue;
    }
    if (!isMeaningfulDistinct(c, out)) {
      rejected_dup++;
      continue;
    }
    seen.add(sig);
    out.push(c);
    added++;
  }
  if (added > 0 && !sources_used.includes(source)) sources_used.push(source);
  return { added, rejected_dup };
}

/**
 * Multi-cycle expand: evidence/intent only — NO suffix angle variants.
 * Each cycle recomputes shortfall = canonical - current.
 */
export function recoverExpandCandidates(opts: {
  existing: any[];
  publishedSubjects: string[];
  publishedEvidence: Array<{
    text: string;
    source_id?: string;
    published_at?: string;
    post_type?: string;
  }>;
  intentText?: string;
  canonical_target: number;
  id_prefix?: string;
  max_cycles?: number;
}): ExpandRecoveryResult {
  const sources_used: string[] = [];
  const replacements: ReplacementRecord[] = [];
  const canonical = Math.max(0, Number(opts.canonical_target) || 0);
  const seen = new Set<string>();
  const out: any[] = [];
  const maxCycles = opts.max_cycles ?? MAX_EXPAND_CYCLES;
  let rejected_as_near_duplicate = 0;

  const first = ingestDistinct(out, seen, opts.existing || [], "existing", sources_used);
  rejected_as_near_duplicate += first.rejected_dup;
  const shortfall_before = computeShortfall(canonical, out.length);
  let cycles = 0;
  const existingCount = out.length;

  while (computeShortfall(canonical, out.length) > 0 && cycles < maxCycles) {
    cycles++;
    const before = out.length;
    const need = computeShortfall(canonical, out.length);
    if (need <= 0) break;

    const local = bootstrapCandidatesFromDimensions({
      publishedSubjects: opts.publishedSubjects || [],
      publishedEvidence: opts.publishedEvidence || [],
      intentText: opts.intentText,
    });
    const gated = applyLocalGates(local, [], createSeedIdFactory(`${opts.id_prefix || "r"}c${cycles}`));
    const r1 = ingestDistinct(out, seen, gated.passed, "evidence_rebootstrap", sources_used);
    rejected_as_near_duplicate += r1.rejected_dup;
    if (computeShortfall(canonical, out.length) <= 0) break;

    if (String(opts.intentText || "").trim().length >= 10) {
      const intentLocal = bootstrapCandidatesFromDimensions({
        publishedSubjects: [],
        publishedEvidence: [],
        intentText: opts.intentText,
      });
      const ig = applyLocalGates(intentLocal, [], createSeedIdFactory(`i${cycles}`));
      const r2 = ingestDistinct(out, seen, ig.passed, "intent_bootstrap", sources_used);
      rejected_as_near_duplicate += r2.rejected_dup;
    }
    if (computeShortfall(canonical, out.length) <= 0) break;

    const subjects = opts.publishedSubjects || [];
    if (subjects.length) {
      const start = ((cycles - 1) * 7) % Math.max(1, subjects.length);
      const window = subjects.slice(start, start + 12);
      const shardSeeds = window
        .map((t) => {
          const text = String(t || "").trim().slice(0, 100);
          if (text.length < 12) return null;
          return {
            cluster: "OTHER",
            dimension: "OBSERVATION",
            concrete_subject: text,
            subject_signature: subjectSignature(text),
            primary_source: "EVIDENCE_DERIVED",
            supporting_sources: ["PUBLISHED_SUBJECT_SHARD"],
            status: "ELIGIBLE",
            creator_evidence_available: true,
            claim_types: ["OBSERVATION"],
            grounding_status: "GROUNDED",
          };
        })
        .filter(Boolean);
      const sg = applyLocalGates(shardSeeds as any[], [], createSeedIdFactory(`sh${cycles}`));
      const r3 = ingestDistinct(out, seen, sg.passed, "published_subject_shard", sources_used);
      rejected_as_near_duplicate += r3.rejected_dup;
    }

    if (out.length === before) break;
  }

  for (let i = existingCount; i < out.length; i++) {
    replacements.push({
      replacement_slot_id: String(out[i].seed_id || out[i].subject_signature || `exp_${i}`),
      replacement_reason: "EXPAND_SHORTFALL",
      source_stage: "expand",
      retry_number: cycles,
    });
  }

  return {
    candidates: out,
    recovered: Math.max(0, out.length - existingCount),
    shortfall_before,
    shortfall_after: computeShortfall(canonical, out.length),
    canonical_target: canonical,
    sources_used,
    cycles,
    replacements,
    target_met: out.length >= canonical,
    rejected_as_near_duplicate,
  };
}

/**
 * Select recovery with live expandRefill. No fixed refill size.
 */
export function recoverSelectSlots(opts: {
  days: Array<{ dayOffset: number; posts: any[] }>;
  pool: ConcreteSeed[];
  selected: ConcreteSeed[];
  canonical_target: number;
  postsPerDay: number;
  compactSlot: (seed: ConcreteSeed, dayOffset: number, slot: number, mode: string) => any;
  modes: string[];
  expandRefill?: () => ConcreteSeed[];
  max_cycles?: number;
}): SelectRecoveryResult {
  const days = opts.days.map((d) => ({
    dayOffset: d.dayOffset,
    posts: [...(d.posts || [])],
  }));
  const pool = [...opts.pool];
  const selected = [...opts.selected];
  const canonical = Math.max(0, Number(opts.canonical_target) || 0);
  let flat = days.reduce((s, d) => s + d.posts.length, 0);
  const shortfall_before = computeShortfall(canonical, flat);
  let recovered = 0;
  let cycles = 0;
  let expand_request_count = 0;
  const replacements: ReplacementRecord[] = [];
  const maxCycles = opts.max_cycles ?? MAX_SELECT_CYCLES;
  const seenSig = new Set(
    selected.map((s) => subjectSignature(String(s.concrete_subject || "")))
  );

  while (computeShortfall(canonical, flat) > 0 && cycles < maxCycles) {
    cycles++;
    if (computeShortfall(canonical, flat) <= 0) break;

    if (pool.length === 0) {
      if (opts.expandRefill) {
        expand_request_count++;
        const more = opts.expandRefill() || [];
        for (const s of more) {
          const sig = subjectSignature(String(s.concrete_subject || ""));
          if (!sig || seenSig.has(sig)) continue;
          if (!isMeaningfulDistinct(s, selected)) continue;
          seenSig.add(sig);
          pool.push({ ...s, status: (s.status as any) || "ELIGIBLE" });
        }
      }
      if (pool.length === 0) break;
    }

    let minD = 0;
    for (let i = 1; i < days.length; i++) {
      if (days[i].posts.length < days[minD].posts.length) minD = i;
    }

    let pickedIdx = -1;
    let pickedMode = opts.modes[0] || "INFORMATIVE";
    for (const mode of opts.modes) {
      const idx = pool.findIndex(
        (s) =>
          isSelectableStatus(s.status as any) &&
          canServeEditorialMode(s, mode) &&
          isMeaningfulDistinct(s, selected) &&
          ideaAngleGuardAllow(s, selected, { softSecond: true }).allow
      );
      if (idx >= 0) {
        pickedIdx = idx;
        pickedMode = mode;
        break;
      }
    }
    if (pickedIdx < 0) {
      pickedIdx = pool.findIndex(
        (s) =>
          (isSelectableStatus(s.status as any) || s.status === "HOLD") &&
          isMeaningfulDistinct(s, selected)
      );
      if (pickedIdx >= 0) pool[pickedIdx] = { ...pool[pickedIdx], status: "ELIGIBLE" };
    }
    if (pickedIdx < 0) {
      if (opts.expandRefill && expand_request_count < 5) {
        expand_request_count++;
        const more = opts.expandRefill() || [];
        for (const s of more) {
          const sig = subjectSignature(String(s.concrete_subject || ""));
          if (!sig || seenSig.has(sig)) continue;
          if (!isMeaningfulDistinct(s, selected)) continue;
          seenSig.add(sig);
          pool.push({ ...s, status: "ELIGIBLE" as any });
        }
        if (pool.length === 0) break;
        continue;
      }
      break;
    }

    const seed = pool.splice(pickedIdx, 1)[0];
    selected.push(seed);
    const slotNum = days[minD].posts.length + 1;
    const post = opts.compactSlot(seed, minD, slotNum, pickedMode);
    days[minD].posts.push(post);
    flat++;
    recovered++;
    replacements.push({
      replacement_slot_id: String(post.slotId || `D${minD + 1}P${slotNum}`),
      replacement_reason: "SELECT_SHORTFALL",
      source_stage: "select",
      retry_number: cycles,
    });
  }

  return {
    days,
    recovered,
    shortfall_before,
    shortfall_after: computeShortfall(canonical, flat),
    canonical_target: canonical,
    cycles,
    need_expand_again: computeShortfall(canonical, flat) > 0 && pool.length === 0,
    expand_request_count,
    replacements,
    target_met: flat >= canonical,
  };
}

export function strictCountPass(canonical: number, finalCount: number): boolean {
  if (canonical <= 0) return false;
  return finalCount >= canonical && finalCount <= canonical + 1;
}
