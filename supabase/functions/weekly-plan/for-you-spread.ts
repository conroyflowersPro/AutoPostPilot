/**
 * X For You author-diversity spacing for Edge (America/Los_Angeles).
 * ~2h between originals. 14:00–22:00 PT are audience posting hours, not an AP For You window.
 * Mirrors lib/schedule.ts without importing Next lib/.
 */
const TZ = "America/Los_Angeles";
export const FOR_YOU_START_HOUR = 14;
export const FOR_YOU_END_HOUR = 22;

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

function stepTwoHoursIso(firstMs: number, count: number): string[] {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return [];
  const gap = 2 * 60 * 60 * 1000;
  const out: string[] = [];
  let t = firstMs;
  while (out.length < n) {
    let p = laParts(new Date(t));
    if (p.hour < FOR_YOU_START_HOUR) {
      t = Date.parse(laWallTimeToISO(p.year, p.month, p.day, FOR_YOU_START_HOUR, 0));
      p = laParts(new Date(t));
    }
    if (p.hour > FOR_YOU_END_HOUR) {
      const next = addDays(p.year, p.month, p.day, 1);
      t = Date.parse(laWallTimeToISO(next.year, next.month, next.day, FOR_YOU_START_HOUR, 0));
    }
    out.push(new Date(t).toISOString());
    t += gap;
  }
  return out;
}

function formatPt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const p = laParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} PT`;
}

export function stampPlannerSlotTimes<T extends { day_offset: number; planned_at?: string; planned_pt?: string }>(
  startDate: string,
  slots: T[],
): T[] {
  const origin = parseStartDate(startDate);
  const byDay = new Map<number, T[]>();
  for (const slot of slots) {
    const day = Math.max(0, Math.min(6, Math.round(Number(slot.day_offset) || 0)));
    const list = byDay.get(day) || [];
    list.push(slot);
    byDay.set(day, list);
  }
  for (const [day, list] of byDay) {
    const cal = addDays(origin.year, origin.month, origin.day, day);
    const firstMs = Date.parse(laWallTimeToISO(cal.year, cal.month, cal.day, FOR_YOU_START_HOUR, 0));
    const times = stepTwoHoursIso(firstMs, list.length);
    list.forEach((slot, i) => {
      slot.planned_at = times[i] || "";
      slot.planned_pt = times[i] ? formatPt(times[i]) : "";
    });
  }
  return slots;
}
