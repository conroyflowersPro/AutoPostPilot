/**
 * Scene/cluster diversity for public seeds, Creator DNA placement, and Writer.
 * Clusters are situations, not RETURN/BRIDGE/REACH and not editorial types.
 */

export type SituationCluster =
  | "FSD"
  | "DRIVING"
  | "PARKING"
  | "INTERSECTION"
  | "OTHER";

export type JudgmentAngle = "BETTER_THAN_BEFORE" | "STILL_AMBIGUOUS" | "OTHER";

/** FSD + commute/drive scenes share the daily cap. */
export const DRIVING_FAMILY: ReadonlySet<SituationCluster> = new Set([
  "FSD",
  "DRIVING",
  "PARKING",
  "INTERSECTION",
]);

export const FSD_DRIVING_PER_DAY_MAX = 2;
export const DRIVING_FAMILY_SHARE_MAX = 0.35;

export function situationCluster(text: string): SituationCluster {
  const t = String(text || "").toLowerCase();
  if (/fsd|완전자율|오토파일럿|autosteer|autopilot/.test(t)) return "FSD";
  if (/교차로|신호등|횡단보도/.test(t)) return "INTERSECTION";
  if (/주차|후진|주차장/.test(t)) return "PARKING";
  if (/출퇴근|운전|핸들|차선|주행/.test(t)) return "DRIVING";
  return "OTHER";
}

export function isDrivingFamilyCluster(cluster: SituationCluster): boolean {
  return DRIVING_FAMILY.has(cluster);
}

export function judgmentAngle(text: string): JudgmentAngle {
  const t = String(text || "");
  if (/예전보다\s*낫|이전보다\s*낫|훨씬\s*나아|확실히\s*좋아/.test(t)) return "BETTER_THAN_BEFORE";
  if (/아직\s*애매|아직은\s*애매|아직\s*모호|아직은\s*이르|아직\s*닫기/.test(t)) return "STILL_AMBIGUOUS";
  return "OTHER";
}

export function seedIsFsdSituation(text: string): boolean {
  return situationCluster(text) === "FSD";
}

/** Charging / Uber / generic driving bolted onto a non-FSD seed. */
export function hasUnseededDrivingBoltOn(situation: string, extra = ""): boolean {
  if (seedIsFsdSituation(situation)) return false;
  const bolt = /충전|우버|\buber\b|fsd|완전자율|주행\s*일반/i;
  return bolt.test(String(extra || "")) && !bolt.test(String(situation || ""));
}

export function drivingFamilyShare(texts: string[]): number {
  const n = texts.length;
  if (!n) return 0;
  const hits = texts.filter((t) => isDrivingFamilyCluster(situationCluster(t))).length;
  return hits / n;
}

/** Drop later driving-family seeds when the batch is overweight. */
export function deferOverweightDrivingFamily<T extends { concrete_subject?: string }>(
  seeds: T[],
): T[] {
  const texts = seeds.map((s) => String(s.concrete_subject || ""));
  if (drivingFamilyShare(texts) <= DRIVING_FAMILY_SHARE_MAX) return seeds;
  const maxKeep = Math.max(1, Math.ceil(seeds.length * DRIVING_FAMILY_SHARE_MAX));
  let kept = 0;
  return seeds.filter((s) => {
    if (!isDrivingFamilyCluster(situationCluster(String(s.concrete_subject || "")))) return true;
    kept += 1;
    return kept <= maxKeep;
  });
}

export function canPlaceAfterPrevious(args: {
  nextSubject: string;
  nextObservation?: string;
  prevSubject?: string;
  prevObservation?: string;
  dayDrivingCount: number;
}): boolean {
  const next = `${args.nextSubject} ${args.nextObservation || ""}`;
  const cluster = situationCluster(args.nextSubject);
  if (isDrivingFamilyCluster(cluster) && args.dayDrivingCount >= FSD_DRIVING_PER_DAY_MAX) {
    return false;
  }
  if (args.prevSubject) {
    const prevCluster = situationCluster(args.prevSubject);
    if (cluster !== "OTHER" && cluster === prevCluster) return false;
    const prevAngle = judgmentAngle(`${args.prevSubject} ${args.prevObservation || ""}`);
    const nextAngle = judgmentAngle(next);
    if (prevAngle !== "OTHER" && prevAngle === nextAngle) return false;
  }
  return true;
}

export function diversifyAssignments<A extends { slot_id: string; seed_id: string }>(
  assignments: A[],
  slots: Array<{ slot_id: string; day_offset: number }>,
  pool: Array<{ seed_id?: string; concrete_subject?: string; point_or_tension?: string; owner?: string; seed_source?: string }>,
): A[] {
  const byId = new Map(pool.map((s) => [String(s.seed_id || ""), s]));
  const slotDay = new Map(slots.map((s) => [s.slot_id, s.day_offset]));
  const ordered = [...assignments].sort((a, b) => {
    const da = slotDay.get(a.slot_id) ?? 0;
    const db = slotDay.get(b.slot_id) ?? 0;
    if (da !== db) return da - db;
    return String(a.slot_id).localeCompare(String(b.slot_id));
  });
  const used = new Set(ordered.map((a) => a.seed_id));
  const unused = pool.filter((s) => s.seed_id && !used.has(String(s.seed_id)));
  const sameOwner = (a?: { owner?: string; seed_source?: string }, b?: { owner?: string; seed_source?: string }) => {
    const self = (s?: { owner?: string; seed_source?: string }) =>
      String(s?.owner || "").toUpperCase() === "SELF"
      || String(s?.seed_source || "").toUpperCase() === "ANALYTICS_LIVED";
    return self(a) === self(b);
  };
  const dayCount = new Map<number, number>();
  let prev: { subject: string; obs: string } | undefined;
  for (const a of ordered) {
    const seed = byId.get(a.seed_id);
    const day = slotDay.get(a.slot_id) ?? 0;
    const subject = String(seed?.concrete_subject || "");
    const obs = String(seed?.point_or_tension || "");
    const drivingN = dayCount.get(day) || 0;
    const ok = canPlaceAfterPrevious({
      nextSubject: subject,
      nextObservation: obs,
      prevSubject: prev?.subject,
      prevObservation: prev?.obs,
      dayDrivingCount: drivingN,
    });
    if (!ok) {
      const swapAt = unused.findIndex((u) =>
        sameOwner(seed, u) &&
        canPlaceAfterPrevious({
          nextSubject: String(u.concrete_subject || ""),
          nextObservation: String(u.point_or_tension || ""),
          prevSubject: prev?.subject,
          prevObservation: prev?.obs,
          dayDrivingCount: drivingN,
        }),
      );
      if (swapAt >= 0) {
        const neu = unused.splice(swapAt, 1)[0];
        if (seed) unused.push(seed);
        a.seed_id = String(neu.seed_id);
        byId.set(a.seed_id, neu);
        const ns = String(neu.concrete_subject || "");
        const no = String(neu.point_or_tension || "");
        if (isDrivingFamilyCluster(situationCluster(ns))) dayCount.set(day, drivingN + 1);
        prev = { subject: ns, obs: no };
        continue;
      }
    }
    if (isDrivingFamilyCluster(situationCluster(subject))) dayCount.set(day, drivingN + 1);
    prev = { subject, obs };
  }
  return ordered;
}

