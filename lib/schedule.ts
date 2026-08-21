/**
 * Korean-track scheduling (America/Los_Angeles).
 *
 * Personal @Seung4680 lock: 11:00, 15:00, 19:00 PT only.
 * 3 originals per Pacific day. 4-hour gap. Never a 2-hour 14:00–22:00 step.
 * Shop/other accounts are not in this repo — this is the default personal cadence.
 */

const TZ = "America/Los_Angeles";
const MODEL = "grok-4.6";

/** Locked personal clocks (America/Los_Angeles). */
export const PERSONAL_CLOCK_HOURS = [11, 15, 19] as const;
export const PERSONAL_POSTS_PER_DAY = 3;
export const PERSONAL_GAP_HOURS = 4;
export const PERSONAL_GAP_MS = PERSONAL_GAP_HOURS * 60 * 60 * 1000;

/** First personal clock of a Pacific calendar day. */
export const FOR_YOU_START_HOUR = PERSONAL_CLOCK_HOURS[0];
/** Last personal clock of a Pacific calendar day. */
export const FOR_YOU_END_HOUR = PERSONAL_CLOCK_HOURS[PERSONAL_CLOCK_HOURS.length - 1];
/** Personal @Seung4680 gap between originals. */
export const FOR_YOU_PREFERRED_GAP_MS = PERSONAL_GAP_MS;
export const FOR_YOU_HARD_MIN_GAP_MS = PERSONAL_GAP_MS;

const ANCHOR_HOUR = FOR_YOU_START_HOUR;

export function getLAParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "0";

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

export function laWallTimeToISO(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): string {
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 8, minute));
  for (let i = 0; i < 48; i++) {
    const p = getLAParts(guess);
    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    ) {
      return guess.toISOString();
    }
    const targetMin = hour * 60 + minute;
    const actualMin = p.hour * 60 + p.minute;
    let diff = targetMin - actualMin;
    if (p.day !== day || p.month !== month) {
      diff += (day - p.day) * 24 * 60;
    }
    guess.setUTCMinutes(guess.getUTCMinutes() + diff);
  }
  return guess.toISOString();
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  add: number
) {
  const d = new Date(Date.UTC(year, month - 1, day + add, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value || "0";
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
  };
}

function dayStartMs(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(laWallTimeToISO(year, month, day, hour, minute)).getTime();
}

export function isPersonalClockHour(hour: number): boolean {
  return (PERSONAL_CLOCK_HOURS as readonly number[]).includes(hour);
}

/** Next locked clock on or after this instant. After 19:00 PT → next day's 11:00. */
export function nextPersonalClockOnOrAfter(isoOrMs: string | number): string {
  const ms = typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs);
  if (!Number.isFinite(ms)) return computeKRBatchStartISO();
  const p = getLAParts(new Date(ms));
  for (const hour of PERSONAL_CLOCK_HOURS) {
    const clock = dayStartMs(p.year, p.month, p.day, hour, 0);
    if (clock >= ms - 500) return new Date(clock).toISOString();
  }
  const next = addCalendarDays(p.year, p.month, p.day, 1);
  return laWallTimeToISO(next.year, next.month, next.day, ANCHOR_HOUR, 0);
}

/** How many originals fit in [startMs, endMs] at the personal 4-hour gap. */
export function forYouFitCount(startMs: number, endMs: number): number {
  if (!(endMs >= startMs)) return 0;
  return Math.floor((endMs - startMs) / FOR_YOU_HARD_MIN_GAP_MS) + 1;
}

/**
 * Even-spread helper (tests / callers). Scheduling itself uses locked clocks.
 */
export function evenSpreadInWindow(firstMs: number, endMs: number, count: number): string[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  if (n === 1) return [new Date(firstMs).toISOString()];
  const span = Math.max(0, endMs - firstMs);
  const gap = span / (n - 1);
  const slots: string[] = [];
  for (let i = 0; i < n; i++) {
    slots.push(new Date(Math.round(firstMs + gap * i)).toISOString());
  }
  return slots;
}

/** Remaining {11, 15, 19} on this Pacific day from firstHour. */
function stepPersonalClocksDay(
  year: number,
  month: number,
  day: number,
  count: number,
  firstHour: number,
  firstMinute = 0
): string[] {
  const n = Math.max(0, Math.floor(count));
  const slots: string[] = [];
  for (const hour of PERSONAL_CLOCK_HOURS) {
    if (slots.length >= n) break;
    if (hour < firstHour) continue;
    if (hour === firstHour && firstMinute > 0) continue;
    slots.push(laWallTimeToISO(year, month, day, hour, 0));
  }
  return slots;
}

/** Start ISO for a given LA calendar date YYYY-MM-DD */
export function computeStartISOForDate(
  dateStr: string,
  now = new Date()
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return computeKRBatchStartISO(now);

  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const nowP = getLAParts(now);

  const isToday =
    nowP.year === year && nowP.month === month && nowP.day === day;

  if (isToday) {
    return computeKRBatchStartISO(now);
  }

  return laWallTimeToISO(year, month, day, ANCHOR_HOUR, 0);
}

export function computeKRBatchStartISO(now = new Date()): string {
  return nextPersonalClockOnOrAfter(now.getTime());
}

/** Snap onto the next locked personal clock (same day 11/15/19 or next day 11:00). */
export function snapToForYouWindow(isoOrMs: string | number): string {
  return nextPersonalClockOnOrAfter(isoOrMs);
}

/**
 * Continue after times already on AP/Fedica so a retry does not reuse 11:00
 * and does not pack 20/21/22. Next of {11, 15, 19} today, else next day's 11:00.
 */
export function nextForYouSlotAfterOccupied(
  startISO: string,
  occupiedISOs: string[],
  gapMs = FOR_YOU_PREFERRED_GAP_MS,
  hardMs = FOR_YOU_HARD_MIN_GAP_MS
): string {
  let cursor = Date.parse(nextPersonalClockOnOrAfter(startISO));
  if (!Number.isFinite(cursor)) cursor = Date.parse(computeKRBatchStartISO());
  const occ = occupiedISOs
    .map((x) => Date.parse(x))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  const latest = occ.length ? occ[occ.length - 1] : NaN;
  if (Number.isFinite(latest) && latest + hardMs > cursor) {
    cursor = Date.parse(nextPersonalClockOnOrAfter(latest + gapMs));
  }
  let guard = 0;
  while (guard++ < 400) {
    const conflict = occ.find((ms) => Math.abs(ms - cursor) < hardMs);
    if (!conflict) return nextPersonalClockOnOrAfter(cursor);
    cursor = Date.parse(nextPersonalClockOnOrAfter(conflict + gapMs));
  }
  return nextPersonalClockOnOrAfter(cursor);
}

/**
 * Spread posts across Pacific days from startISO using 11/15/19 only.
 * Legacy helper for posts that have no Agent승 planned_at.
 * Generation Job and Fedica must not use this to overwrite Agent승 planned_at.
 * Flag lives in `lib/fedica-strategy-contract.ts` (do not re-export with a .ts path — Next build forbids it).
 */

export function buildDaySpreadSlots(
  startISO: string,
  count: number,
  maxPerDay = PERSONAL_POSTS_PER_DAY
): string[] {
  if (count <= 0) return [];
  const slots: string[] = [];
  const start = new Date(startISO);
  let parts = getLAParts(start);
  let firstHour = parts.hour;
  let firstMinute = parts.minute;
  let remaining = count;
  const cap = Math.min(PERSONAL_POSTS_PER_DAY, Math.max(1, maxPerDay));

  let guard = 0;
  while (remaining > 0 && guard < 60) {
    guard += 1;
    const want = Math.min(remaining, cap);
    const daySlots = stepPersonalClocksDay(
      parts.year,
      parts.month,
      parts.day,
      want,
      firstHour,
      firstMinute
    );
    if (daySlots.length === 0) {
      const next = addCalendarDays(parts.year, parts.month, parts.day, 1);
      parts = { ...next, hour: ANCHOR_HOUR, minute: 0 };
      firstHour = ANCHOR_HOUR;
      firstMinute = 0;
      continue;
    }
    slots.push(...daySlots);
    remaining -= daySlots.length;
    const next = addCalendarDays(parts.year, parts.month, parts.day, 1);
    parts = { ...next, hour: ANCHOR_HOUR, minute: 0 };
    firstHour = ANCHOR_HOUR;
    firstMinute = 0;
  }
  return slots;
}

export function fallbackSlots(startISO: string, count: number): string[] {
  return buildDaySpreadSlots(startISO, count, PERSONAL_POSTS_PER_DAY);
}

function timesRespectForYou(times: string[], startISO: string, maxPerDay: number): boolean {
  if (times.length === 0) return false;
  const startMs = new Date(startISO).getTime();
  let last = startMs - FOR_YOU_HARD_MIN_GAP_MS;
  const perDay = new Map<string, number>();
  const cap = Math.min(PERSONAL_POSTS_PER_DAY, Math.max(1, maxPerDay));
  for (const t of times) {
    const ms = new Date(t).getTime();
    if (isNaN(ms) || ms < startMs) return false;
    if (ms < last + FOR_YOU_HARD_MIN_GAP_MS) return false;
    const p = getLAParts(new Date(ms));
    if (!isPersonalClockHour(p.hour) || p.minute !== 0) return false;
    const key = `${p.year}-${p.month}-${p.day}`;
    perDay.set(key, (perDay.get(key) || 0) + 1);
    if ((perDay.get(key) || 0) > cap) return false;
    last = ms;
  }
  return true;
}

export async function assignSlotsWithGrok(
  posts: { id: string; content: string }[],
  startISO: string,
  xaiKey: string,
  maxPerDay = PERSONAL_POSTS_PER_DAY
): Promise<string[]> {
  if (posts.length === 0) return [];

  const cap = Math.min(PERSONAL_POSTS_PER_DAY, Math.max(1, maxPerDay));
  const base = buildDaySpreadSlots(startISO, posts.length, cap);

  const system = `Assign X post times, timezone America/Los_Angeles.
Personal @Seung4680 clocks are 11:00, 15:00, 19:00 PT only. 3 posts per day. 4-hour gap.
Do not stamp 14:00, 16:00, 18:00, 20:00, or 22:00. Do not step by 2 hours.
First at/after ${startISO}; max ${cap} per calendar day; next day starts 11:00.
Do not write captions. Times only.
Return same order ISO UTC. JSON only: { "times": ["..."] }`;

  const user = `Refine ${posts.length} times onto 11/15/19 PT only.
Base suggestion:
${base.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) return base;

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    const times: string[] = parsed.times || [];
    if (times.length !== posts.length) return base;
    if (!timesRespectForYou(times, startISO, cap)) return base;
    return times;
  } catch {
    return base;
  }
}
