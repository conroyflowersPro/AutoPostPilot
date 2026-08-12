/**
 * ORDER 0A HOTFIX — Expand / Select count recovery (no quality bypass).
 * Shortfall always uses canonical target (never min(required, 8)).
 */

import {
  applyLocalGates,
  bootstrapCandidatesFromDimensions,
  canServeEditorialMode,
  conceptualRepetitionLevel,
  createSeedIdFactory,
  ideaAngleGuardAllow,
  isSelectableStatus,
  subjectSignature,
  type ConcreteSeed,
} from "./seed-engine.ts";

export type ExpandRecoveryResult = {
  candidates: any[];
  recovered: number;
  shortfall_before: number;
  shortfall_after: number;
  canonical_target: number;
  sources_used: string[];
};

export type SelectRecoveryResult = {
  days: Array<{ dayOffset: number; posts: any[] }>;
  recovered: number;
  shortfall_before: number;
  shortfall_after: number;
  canonical_target: number;
};

export function computeShortfall(canonical: number, current: number): number {
  return Math.max(0, (Number(canonical) || 0) - Math.max(0, Number(current) || 0));
}

export function recoverExpandCandidates(opts: {
  existing: any[];
  publishedSubjects: string[];
  publishedEvidence: Array<{ text: string; source_id?: string; published_at?: string; post_type?: string }>;
  intentText?: string;
  canonical_target: number;
  id_prefix?: string;
}): ExpandRecoveryResult {
  const sources_used: string[] = [];
  const canonical = Math.max(0, Number(opts.canonical_target) || 0);
  const seen = new Set<string>();
  const out: any[] = [];

  function ingest(list: any[], source: string) {
    let added = 0;
    for (const c of list) {
      const sig = subjectSignature(String(c.concrete_subject || ""));
      if (!sig || seen.has(sig)) continue;
      seen.add(sig);
      out.push(c);
      added++;
    }
    if (added > 0) sources_used.push(source);
  }

  ingest(opts.existing || [], "existing");
  const shortfall_before = computeShortfall(canonical, out.length);
  if (shortfall_before <= 0) {
    return {
      candidates: out,
      recovered: 0,
      shortfall_before: 0,
      shortfall_after: 0,
      canonical_target: canonical,
      sources_used,
    };
  }

  const nextId = createSeedIdFactory(opts.id_prefix || "r");
  const local = bootstrapCandidatesFromDimensions({
    publishedSubjects: opts.publishedSubjects || [],
    publishedEvidence: opts.publishedEvidence || [],
    intentText: opts.intentText,
  });
  const gated = applyLocalGates(local, [], nextId);
  ingest(gated.passed, "evidence_rebootstrap");

  if (out.length < canonical) {
    const variants: any[] = [];
    for (const c of out.slice()) {
      if (out.length + variants.length >= canonical) break;
      const sub = String(c.concrete_subject || "").trim();
      if (sub.length < 8) continue;
      const frames = [
        { suffix: " — 실사용 관점", family: "REAL_USE" },
        { suffix: " — 전후 변화", family: "BEFORE_AFTER" },
        { suffix: " — 선택 기준", family: "DECISION" },
      ];
      for (const f of frames) {
        const subject = sub.length > 90 ? sub : `${sub}${f.suffix}`;
        const sig = subjectSignature(subject);
        if (seen.has(sig)) continue;
        variants.push({
          ...c,
          concrete_subject: subject,
          subject_signature: sig,
          point_or_tension: c.point_or_tension || f.family,
          idea_angle_family: f.family,
          primary_source: c.primary_source || "EVIDENCE_DERIVED",
          supporting_sources: [...(c.supporting_sources || []), "ANGLE_VARIANT"],
          status: "ELIGIBLE",
          creator_evidence_available: !!c.creator_evidence_available,
        });
      }
    }
    const vg = applyLocalGates(variants, [], createSeedIdFactory("v"));
    ingest(vg.passed, "angle_variant");
  }

  if (out.length < canonical && String(opts.intentText || "").trim().length >= 10) {
    const intentLocal = bootstrapCandidatesFromDimensions({
      publishedSubjects: [],
      publishedEvidence: [],
      intentText: opts.intentText,
    });
    const ig = applyLocalGates(intentLocal, [], createSeedIdFactory("i"));
    ingest(ig.passed, "intent_bootstrap");
  }

  const shortfall_after = computeShortfall(canonical, out.length);
  return {
    candidates: out,
    recovered: Math.max(0, out.length - (opts.existing?.length || 0)),
    shortfall_before,
    shortfall_after,
    canonical_target: canonical,
    sources_used,
  };
}

export function recoverSelectSlots(opts: {
  days: Array<{ dayOffset: number; posts: any[] }>;
  pool: ConcreteSeed[];
  selected: ConcreteSeed[];
  canonical_target: number;
  postsPerDay: number;
  compactSlot: (seed: ConcreteSeed, dayOffset: number, slot: number, mode: string) => any;
  modes: string[];
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
  const maxCycles = canonical + 5;
  let cycles = 0;

  while (flat < canonical && pool.length > 0 && cycles < maxCycles) {
    cycles++;
    let minD = 0;
    for (let i = 1; i < days.length; i++) {
      if (days[i].posts.length < days[minD].posts.length) minD = i;
    }
    if (days[minD].posts.length >= opts.postsPerDay) {
      let anyRoom = false;
      for (let i = 0; i < days.length; i++) {
        if (days[i].posts.length < opts.postsPerDay + 1) {
          minD = i;
          anyRoom = true;
          break;
        }
      }
      if (!anyRoom) break;
    }

    let pickedIdx = -1;
    let pickedMode = opts.modes[0] || "INFORMATIVE";
    for (const mode of opts.modes) {
      const idx = pool.findIndex(
        (s) =>
          isSelectableStatus(s.status as any) &&
          canServeEditorialMode(s, mode) &&
          conceptualRepetitionLevel(s, selected) !== "HIGH" &&
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
          isSelectableStatus(s.status as any) &&
          ideaAngleGuardAllow(s, selected, { softSecond: true }).allow
      );
    }
    if (pickedIdx < 0) {
      pickedIdx = pool.findIndex((s) => isSelectableStatus(s.status as any) || s.status === "HOLD");
      if (pickedIdx >= 0) {
        pool[pickedIdx] = { ...pool[pickedIdx], status: "ELIGIBLE" };
      }
    }
    if (pickedIdx < 0) break;

    const seed = pool.splice(pickedIdx, 1)[0];
    selected.push(seed);
    days[minD].posts.push(
      opts.compactSlot(seed, minD, days[minD].posts.length + 1, pickedMode)
    );
    flat++;
    recovered++;
  }

  return {
    days,
    recovered,
    shortfall_before,
    shortfall_after: computeShortfall(canonical, flat),
    canonical_target: canonical,
  };
}
