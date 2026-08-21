/**
 * Personal @Seung4680 timing for Edge (America/Los_Angeles).
 * Locked clocks: 11:00, 15:00, 19:00 PT. 3 posts/day. 4-hour gap.
 * Agent승 infers among those three. This file snaps onto them and does not invent other hours.
 * Mirrors lib/schedule.ts helpers without importing Next lib/.
 */
const TZ = "America/Los_Angeles";
export const PERSONAL_CLOCK_HOURS = [11, 15, 19] as const;
export const PERSONAL_POSTS_PER_DAY = 3;
export const PERSONAL_GAP_HOURS = 4;
export const FOR_YOU_START_HOUR = PERSONAL_CLOCK_HOURS[0];
export const FOR_YOU_END_HOUR = PERSONAL_CLOCK_HOURS[PERSONAL_CLOCK_HOURS.length - 1];
export const MIN_PLANNED_GAP_MS = PERSONAL_GAP_HOURS * 60 * 60 * 1000;

function laParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour,
    minute: parseInt(get("minute"), 10),
  };
}

export function laWallTimeToISO(year: number, month: number, day: number, hour: number, minute = 0): string {
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 8, minute));
  for (let i = 0; i < 48; i++) {
    const p = laParts(guess);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) {
      return guess.toISOString();
    }
    const targetMin = hour * 60 + minute;
    const actualMin = p.hour * 60 + p.minute;
    let diff = targetMin - actualMin;
    if (p.day !== day || p.month !== month) diff += (day - p.day) * 24 * 60;
    guess.setUTCMinutes(guess.getUTCMinutes() + diff);
  }
  return guess.toISOString();
}

function addDays(year: number, month: number, day: number, n: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + n));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

function parseStartDate(startDate: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate || "").trim());
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  const p = laParts(new Date());
  return { year: p.year, month: p.month, day: p.day };
}

function formatPt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const p = laParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} PT`;
}

const PT_WALL = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/;
const YMD_SPACE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/;
const AMPM = /(\d{1,2}):(\d{2})\s*([AaPp][Mm])/;
const HOUR_KO = /(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/;

export function pinTimeToSlotDay(
  iso: string,
  cal: { year: number; month: number; day: number },
): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const p = laParts(d);
  return laWallTimeToISO(cal.year, cal.month, cal.day, p.hour, p.minute);
}

export function parsePlannerTimestamp(
  raw: unknown,
  day?: { year: number; month: number; day: number },
): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw) && day) {
    const hour = Math.max(0, Math.min(23, Math.floor(raw)));
    const minute = Math.round((raw - hour) * 60);
    return laWallTimeToISO(day.year, day.month, day.day, hour, minute);
  }
  const text = String(raw).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  const wall = PT_WALL.exec(text.replace(/\s*PT$/i, "").trim());
  if (wall) {
    return laWallTimeToISO(
      Number(wall[1]),
      Number(wall[2]),
      Number(wall[3]),
      Number(wall[4]),
      Number(wall[5]),
    );
  }
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed) && /T|\d{4}-\d{2}-\d{2}/.test(text)) {
    return new Date(parsed).toISOString();
  }
  const hourOnly = /^(\d{1,2})(?::(\d{2}))?$/.exec(text);
  if (hourOnly && day) {
    return laWallTimeToISO(day.year, day.month, day.day, Number(hourOnly[1]), Number(hourOnly[2] || 0));
  }
  const ymd = YMD_SPACE.exec(text);
  if (ymd) {
    return laWallTimeToISO(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), Number(ymd[4]), Number(ymd[5]));
  }
  const ampm = AMPM.exec(text);
  if (ampm && day) {
    let hour = Number(ampm[1]) % 12;
    if (/p/i.test(ampm[3])) hour += 12;
    return laWallTimeToISO(day.year, day.month, day.day, hour, Number(ampm[2]));
  }
  const ko = HOUR_KO.exec(text);
  if (ko && day) {
    let hour = Number(ko[1]);
    if (/오후|저녁|밤/.test(text) && hour < 12) hour += 12;
    return laWallTimeToISO(day.year, day.month, day.day, hour, Number(ko[2] || 0));
  }
  return "";
}

export function nearestPersonalClockHour(hour: number, minute = 0): (typeof PERSONAL_CLOCK_HOURS)[number] {
  const mins = Math.max(0, Math.min(23, hour)) * 60 + Math.max(0, Math.min(59, minute));
  let best: (typeof PERSONAL_CLOCK_HOURS)[number] = PERSONAL_CLOCK_HOURS[0];
  let bestDist = Infinity;
  for (const clock of PERSONAL_CLOCK_HOURS) {
    const dist = Math.abs(mins - clock * 60);
    if (dist < bestDist) {
      bestDist = dist;
      best = clock;
    }
  }
  return best;
}

function clockBlocked(
  iso: string,
  occupiedMs: number[],
  gapMs: number,
): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  return occupiedMs.some((o) => Math.abs(o - t) < gapMs);
}

/**
 * Snap Agent승 timestamps onto {11, 15, 19} PT for that slot day.
 * Infers among the three when a slot is missing or two slots prefer the same clock.
 * Does not invent other hours (no 14/16/18/20/22).
 */
export function enforceMinGapOnPlannedTimes<T extends {
  day_offset: number;
  planned_at?: string;
  planned_pt?: string;
  planned_hour?: unknown;
}>(
  startDate: string,
  slots: T[],
  occupiedISOs: string[] = [],
): T[] {
  const origin = parseStartDate(startDate);
  const occupiedMs = occupiedISOs
    .map((x) => Date.parse(x))
    .filter((ms) => Number.isFinite(ms));
  const byDay = new Map<number, T[]>();
  for (const slot of slots) {
    const day = Math.max(0, Math.min(6, Math.round(Number(slot.day_offset) || 0)));
    const list = byDay.get(day) || [];
    list.push(slot);
    byDay.set(day, list);
  }
  for (const [day, daySlots] of byDay) {
    const cal = addDays(origin.year, origin.month, origin.day, day);
    const available = PERSONAL_CLOCK_HOURS.filter((hour) => {
      const iso = laWallTimeToISO(cal.year, cal.month, cal.day, hour, 0);
      return !clockBlocked(iso, occupiedMs, MIN_PLANNED_GAP_MS);
    });
    const prefs = daySlots.map((slot, index) => {
      const iso =
        parsePlannerTimestamp(slot.planned_at, cal)
        || parsePlannerTimestamp(slot.planned_pt, cal)
        || parsePlannerTimestamp(slot.planned_hour, cal);
      const pinned = iso ? pinTimeToSlotDay(iso, cal) : "";
      const p = pinned ? laParts(new Date(pinned)) : null;
      return {
        slot,
        index,
        preferred: p ? nearestPersonalClockHour(p.hour, p.minute) : null,
      };
    });
    const remaining = [...available];
    for (const item of prefs) {
      let pick: number | undefined;
      if (item.preferred != null) {
        pick = remaining.find((h) => h >= item.preferred!) ?? remaining[0];
      } else {
        pick = remaining[0];
      }
      if (pick == null) {
        const fallback = item.preferred ?? PERSONAL_CLOCK_HOURS[Math.min(item.index, PERSONAL_CLOCK_HOURS.length - 1)];
        const stamped = laWallTimeToISO(cal.year, cal.month, cal.day, fallback, 0);
        item.slot.planned_at = stamped;
        item.slot.planned_pt = formatPt(stamped);
        continue;
      }
      remaining.splice(remaining.indexOf(pick), 1);
      const stamped = laWallTimeToISO(cal.year, cal.month, cal.day, pick, 0);
      item.slot.planned_at = stamped;
      item.slot.planned_pt = formatPt(stamped);
    }
  }
  return slots;
}

export function describeSlotTimeCheck<T extends { slot_id?: string; day_offset: number; planned_at?: string }>(
  slots: T[],
  occupiedISOs: string[] = [],
  gapMs = MIN_PLANNED_GAP_MS,
): { ok: boolean; missing: string[]; collisions: string[]; note: string } {
  const missing = (slots || [])
    .filter((s) => !Number.isFinite(Date.parse(String(s.planned_at || ""))))
    .map((s) => String(s.slot_id || `day_${s.day_offset}`));
  const stamped = (slots || [])
    .map((s) => ({ id: String(s.slot_id || `day_${s.day_offset}`), ms: Date.parse(String(s.planned_at || "")) }))
    .filter((s) => Number.isFinite(s.ms))
    .sort((a, b) => a.ms - b.ms);
  const occupied = occupiedISOs
    .map((x) => Date.parse(x))
    .filter((ms) => Number.isFinite(ms));
  const collisions: string[] = [];
  for (let i = 1; i < stamped.length; i += 1) {
    const gap = stamped[i].ms - stamped[i - 1].ms;
    if (gap < gapMs) collisions.push(`${stamped[i - 1].id} ↔ ${stamped[i].id} (${Math.round(gap / 60000)}m)`);
  }
  for (const slot of stamped) {
    for (const occ of occupied) {
      const gap = Math.abs(slot.ms - occ);
      if (gap < gapMs) collisions.push(`${slot.id} ↔ existing (${Math.round(gap / 60000)}m)`);
    }
  }
  const offClock = (slots || []).filter((s) => {
    const ms = Date.parse(String(s.planned_at || ""));
    if (!Number.isFinite(ms)) return false;
    const p = laParts(new Date(ms));
    return !(PERSONAL_CLOCK_HOURS as readonly number[]).includes(p.hour) || p.minute !== 0;
  }).map((s) => String(s.slot_id || `day_${s.day_offset}`));
  const ok = missing.length === 0 && collisions.length === 0 && offClock.length === 0 && stamped.length === (slots || []).length;
  const note = ok
    ? "times hold"
    : [
      missing.length ? `unparsed ${missing.join(",")}` : "",
      collisions.length ? `gap<4h ${collisions.slice(0, 8).join("; ")}` : "",
      offClock.length ? `not 11/15/19 ${offClock.join(",")}` : "",
    ].filter(Boolean).join(" · ");
  return { ok, missing, collisions, note };
}

export function spacingConstraintHolds<T extends { planned_at?: string }>(
  slots: T[],
  occupiedISOs: string[] = [],
  gapMs = MIN_PLANNED_GAP_MS,
): boolean {
  const times = (slots || [])
    .map((s) => Date.parse(String(s.planned_at || "")))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  if (times.length !== (slots || []).length) return false;
  for (let i = 1; i < times.length; i += 1) {
    if (times[i] - times[i - 1] < gapMs) return false;
  }
  const occupied = occupiedISOs.map((x) => Date.parse(x)).filter((ms) => Number.isFinite(ms));
  for (const t of times) {
    const p = laParts(new Date(t));
    if (!(PERSONAL_CLOCK_HOURS as readonly number[]).includes(p.hour) || p.minute !== 0) return false;
    for (const o of occupied) {
      if (Math.abs(t - o) < gapMs) return false;
    }
  }
  return true;
}

/** Calendar days for slot offsets. Does not stamp 14:00 + 2h. */
export function slotCalendarDays(startDate: string, days: number[]): Array<{ day_offset: number; date: string }> {
  const origin = parseStartDate(startDate);
  return (days || []).map((d) => {
    const cal = addDays(origin.year, origin.month, origin.day, d);
    return {
      day_offset: d,
      date: `${cal.year}-${String(cal.month).padStart(2, "0")}-${String(cal.day).padStart(2, "0")}`,
    };
  });
}

/** Snap Agent승 timestamps onto 11/15/19 PT. Infers among those three only. */
export function stampPlannerSlotTimes<T extends { day_offset: number; planned_at?: string; planned_pt?: string }>(
  startDate: string,
  slots: T[],
  occupiedISOs: string[] = [],
): T[] {
  return enforceMinGapOnPlannedTimes(startDate, slots, occupiedISOs);
}
