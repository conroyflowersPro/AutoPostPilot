/**
 * X For You author-diversity spacing for Edge (America/Los_Angeles).
 * Min gap is a constraint. 14:00–22:00 PT are audience posting hours, not an AP For You window
 * and not a clock template. Agent승 infers timestamps; this file only enforces min gap.
 * Mirrors lib/schedule.ts helpers without importing Next lib/.
 */
const TZ = "America/Los_Angeles";
export const FOR_YOU_START_HOUR = 14;
export const FOR_YOU_END_HOUR = 22;
export const MIN_PLANNED_GAP_MS = 2 * 60 * 60 * 1000;

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
  return "";
}

function pushPastBarriers(ms: number, barriers: number[]): number {
  let t = ms;
  let guard = 0;
  while (guard++ < 80) {
    const hit = barriers.find((b) => Math.abs(t - b) < MIN_PLANNED_GAP_MS || (t > b && t < b + MIN_PLANNED_GAP_MS));
    if (hit == null) return t;
    t = hit + MIN_PLANNED_GAP_MS;
  }
  return t;
}

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
  const occupied = occupiedISOs
    .map((x) => Date.parse(x))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  const dated = slots.map((slot, i) => {
    const day = Math.max(0, Math.min(6, Math.round(Number(slot.day_offset) || 0)));
    const cal = addDays(origin.year, origin.month, origin.day, day);
    const iso =
      parsePlannerTimestamp(slot.planned_at, cal)
      || parsePlannerTimestamp(slot.planned_pt, cal)
      || parsePlannerTimestamp(slot.planned_hour, cal);
    return { slot, day, cal, i, ms: iso ? Date.parse(iso) : NaN };
  });
  dated.sort((a, b) => {
    const am = Number.isFinite(a.ms) ? a.ms : Number.POSITIVE_INFINITY;
    const bm = Number.isFinite(b.ms) ? b.ms : Number.POSITIVE_INFINITY;
    if (am !== bm) return am - bm;
    if (a.day !== b.day) return a.day - b.day;
    return a.i - b.i;
  });
  const planned: number[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const item of dated) {
    let t = Number.isFinite(item.ms) ? item.ms : NaN;
    if (!Number.isFinite(t)) {
      if (Number.isFinite(last) && last > 0) t = last + MIN_PLANNED_GAP_MS;
      else if (occupied.length) t = occupied[occupied.length - 1] + MIN_PLANNED_GAP_MS;
      else t = Date.parse(laWallTimeToISO(item.cal.year, item.cal.month, item.cal.day, 0, 0));
    }
    if (Number.isFinite(last) && t < last + MIN_PLANNED_GAP_MS) t = last + MIN_PLANNED_GAP_MS;
    t = pushPastBarriers(t, [...occupied, ...planned]);
    if (Number.isFinite(last) && t < last + MIN_PLANNED_GAP_MS) t = last + MIN_PLANNED_GAP_MS;
    const iso = new Date(t).toISOString();
    item.slot.planned_at = iso;
    item.slot.planned_pt = formatPt(iso);
    planned.push(t);
    last = t;
  }
  return slots;
}

/** Constraint pass after Agent승 timestamps. Does not stamp a 14:00 + 2h grid. */
export function stampPlannerSlotTimes<T extends { day_offset: number; planned_at?: string; planned_pt?: string }>(
  startDate: string,
  slots: T[],
  occupiedISOs: string[] = [],
): T[] {
  return enforceMinGapOnPlannedTimes(startDate, slots, occupiedISOs);
}
