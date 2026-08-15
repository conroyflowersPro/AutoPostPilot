/**
 * Korean track scheduling (America/Los_Angeles) — For You optimized.
 * - Day starts 14:00 PT (2pm Pacific)
 * - Planner even-spreads originals across the afternoon–evening For You window
 * - Same-author originals in one refresh are decayed; do not stack
 * - For You candidates drop after ~48 hours (spacing only; not a writer recipe)
 */

const TZ = "America/Los_Angeles";
const MODEL = "grok-4.6";

/** First original of a Pacific calendar day. */
export const FOR_YOU_START_HOUR = 14;
/** Last original of a Pacific calendar day (US afternoon/evening For You). */
export const FOR_YOU_END_HOUR = 22;
/** Preferred gap so two originals are less likely to land in the same refresh. */
export const FOR_YOU_PREFERRED_GAP_MS = 2 * 60 * 60 * 1000;
/** Anti-burst floor when quota is dense inside the 14:00–22:00 window. */
export const FOR_YOU_HARD_MIN_GAP_MS = 45 * 60 * 1000;

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

function clampHourToForYouWindow(hour: number): number {
  if (hour < FOR_YOU_START_HOUR) return FOR_YOU_START_HOUR;
  if (hour > FOR_YOU_END_HOUR) return FOR_YOU_END_HOUR;
  return hour;
}

/** How many originals fit in [startMs, endMs] with the anti-burst floor. */
export function forYouFitCount(startMs: number, endMs: number): number {
  if (!(endMs >= startMs)) return 0;
  return Math.floor((endMs - startMs) / FOR_YOU_HARD_MIN_GAP_MS) + 1;
}

/**
 * Even-spread n originals from firstMs through endMs (inclusive).
 * Prefers ~2h gaps; if quota is denser, still spreads instead of stacking at 14:00.
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

function evenSpreadForYouDay(
  year: number,
  month: number,
  day: number,
  count: number,
  firstHour: number,
  firstMinute = 0
): string[] {
  const startH = clampHourToForYouWindow(firstHour);
  const firstMs = dayStartMs(year, month, day, startH, firstMinute);
  const endMs = dayStartMs(year, month, day, FOR_YOU_END_HOUR, 0);
  const fit = forYouFitCount(firstMs, endMs);
  const n = Math.min(count, fit);
  return evenSpreadInWindow(firstMs, endMs, n);
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
  const p = getLAParts(now);
  if (p.hour < ANCHOR_HOUR) {
    return laWallTimeToISO(p.year, p.month, p.day, ANCHOR_HOUR, 0);
  }
  let hour = p.minute > 0 ? p.hour + 1 : p.hour;
  if (p.minute === 0 && p.hour >= ANCHOR_HOUR) hour = p.hour;
  if (hour > FOR_YOU_END_HOUR) {
    const next = addCalendarDays(p.year, p.month, p.day, 1);
    return laWallTimeToISO(next.year, next.month, next.day, ANCHOR_HOUR, 0);
  }
  return laWallTimeToISO(p.year, p.month, p.day, hour, 0);
}

/**
 * Spread posts across Pacific days from startISO.
 * Planner even-spreads inside 14:00–22:00 PT. Extra posts that cannot
 * keep the anti-burst floor roll to the next day at 14:00.
 */
export function buildDaySpreadSlots(
  startISO: string,
  count: number,
  maxPerDay = 5
): string[] {
  if (count <= 0) return [];
  const slots: string[] = [];
  const start = new Date(startISO);
  let parts = getLAParts(start);
  let firstHour = parts.hour;
  let firstMinute = parts.minute;
  let remaining = count;
  const cap = Math.min(8, Math.max(1, maxPerDay));

  let guard = 0;
  while (remaining > 0 && guard < 60) {
    guard += 1;
    const want = Math.min(remaining, cap);
    const daySlots = evenSpreadForYouDay(
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
  return buildDaySpreadSlots(startISO, count, 5);
}

function timesRespectForYou(times: string[], startISO: string, maxPerDay: number): boolean {
  if (times.length === 0) return false;
  const startMs = new Date(startISO).getTime();
  let last = startMs - FOR_YOU_HARD_MIN_GAP_MS;
  const perDay = new Map<string, number>();
  for (const t of times) {
    const ms = new Date(t).getTime();
    if (isNaN(ms) || ms < startMs) return false;
    if (ms < last + FOR_YOU_HARD_MIN_GAP_MS) return false;
    const p = getLAParts(new Date(ms));
    if (p.hour < FOR_YOU_START_HOUR || p.hour > FOR_YOU_END_HOUR) return false;
    const key = `${p.year}-${p.month}-${p.day}`;
    perDay.set(key, (perDay.get(key) || 0) + 1);
    if ((perDay.get(key) || 0) > maxPerDay) return false;
    last = ms;
  }
  return true;
}

export async function assignSlotsWithGrok(
  posts: { id: string; content: string }[],
  startISO: string,
  xaiKey: string,
  maxPerDay = 5
): Promise<string[]> {
  if (posts.length === 0) return [];

  const base = buildDaySpreadSlots(startISO, posts.length, maxPerDay);

  const system = `Assign X post times for For You, timezone America/Los_Angeles.
Rules: first at/after ${startISO}; day window 14:00–22:00 Pacific; even-spread so same-author originals are not stacked in one refresh; prefer ~2h gaps; never closer than 45 minutes; max ${maxPerDay} posts per calendar day; next day starts 14:00.
Do not write captions. Times only.
Return same order ISO UTC. JSON only: { "times": ["..."] }`;

  const user = `Refine ${posts.length} For You times (keep even day spread).
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
    if (!timesRespectForYou(times, startISO, maxPerDay)) return base;
    return times;
  } catch {
    return base;
  }
}
