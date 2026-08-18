/**
 * ORDER 3 — Fedica executes Agent승 timestamps. It does not invent a week plan.
 * Safety (duplicate, occupied, API validation) stays. Strategy recalculation does not.
 */

/** Spacing constraint only. Not a timetable and not a jitter recipe. Same value as FOR_YOU_HARD_MIN_GAP_MS. */
export const MIN_PUBLISH_GAP_MS = 2 * 60 * 60 * 1000;
/** After ORDER 3: Fedica must not overwrite Agent승 planned_at. */
export const FEDICA_OVERWRITES_AGENT_SEUNG_PLANNED_AT = false as const;

export type PlannedPost = {
  id?: string;
  strategy_json?: {
    planned_at?: string | null;
    job_id?: string | null;
    strategy_slot_id?: string | null;
    system_origin_class?: string | null;
  } | null;
  scheduled_at?: string | null;
};

export type ScheduleTimeOk = {
  ok: true;
  iso: string;
  source: "agent_seung_planned_at" | "operator_override";
};

export type ScheduleTimeFail = {
  ok: false;
  code: "missing_planned_at" | "strategy_spacing_broken" | "invalid_timestamp";
  error: string;
};

export function agentSeungPlannedAt(post: PlannedPost | null | undefined): string {
  const raw = String(post?.strategy_json?.planned_at || "").trim();
  if (!raw) return "";
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

export function spacingConflictIso(
  iso: string,
  occupiedISOs: string[],
  gapMs = MIN_PUBLISH_GAP_MS,
): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "invalid";
  for (const other of occupiedISOs || []) {
    const o = Date.parse(other);
    if (!Number.isFinite(o)) continue;
    if (Math.abs(o - t) < gapMs) return other;
  }
  return null;
}

/**
 * Contract: use Agent승 planned_at when present.
 * Operator override (explicit picker) is allowed.
 * Do not compute a replacement grid when planned_at exists but spacing is broken.
 */
export function resolveFedicaScheduleTime(args: {
  post: PlannedPost;
  occupiedISOs: string[];
  operatorOverride?: string | null;
}): ScheduleTimeOk | ScheduleTimeFail {
  const override = String(args.operatorOverride || "").trim();
  if (override) {
    const ms = Date.parse(override);
    if (!Number.isFinite(ms)) {
      return { ok: false, code: "invalid_timestamp", error: "예약 시각이 올바르지 않습니다." };
    }
    const iso = new Date(ms).toISOString();
    const conflict = spacingConflictIso(iso, args.occupiedISOs);
    if (conflict) {
      return {
        ok: false,
        code: "strategy_spacing_broken",
        error: "최소 2시간 간격이 깨져 있습니다. 스케줄러가 새 시각을 만들지 않습니다.",
      };
    }
    return { ok: true, iso, source: "operator_override" };
  }

  const planned = agentSeungPlannedAt(args.post);
  if (!planned) {
    return {
      ok: false,
      code: "missing_planned_at",
      error: "Agent승 계획 시각이 없습니다. Fedica가 주간 전략을 다시 짜지 않습니다.",
    };
  }
  const conflict = spacingConflictIso(planned, args.occupiedISOs);
  if (conflict) {
    return {
      ok: false,
      code: "strategy_spacing_broken",
      error: "Agent승 시각이 최소 간격 제약과 충돌합니다. 스케줄러가 숨겨 고치지 않습니다.",
    };
  }
  return { ok: true, iso: planned, source: "agent_seung_planned_at" };
}
