/**
 * Korean track scheduling (America/Los_Angeles)
 * - Day anchor: 17:00 local
 * - If start day is today and past 17:00 → next full hour
 * - Min 3 hours between posts
 * - Max posts per calendar day (default 5)
 */

const TZ = "America/Los_Angeles";
const MODEL = "grok-4.6";
const ANCHOR_HOUR = 17;
const MIN_GAP_MS = 3 * 60 * 60 * 1000;

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
  const p = getLAParts(d);
  // Use UTC date parts from noon UTC approx; better: format in LA
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
    if (nowP.hour < ANCHOR_HOUR) {
      return laWallTimeToISO(year, month, day, ANCHOR_HOUR, 0);
    }
    let hour = nowP.minute > 0 ? nowP.hour + 1 : nowP.hour;
    if (nowP.minute === 0 && nowP.hour >= ANCHOR_HOUR) hour = nowP.hour;
    if (hour >= 24) {
      const next = addCalendarDays(year, month, day, 1);
      return laWallTimeToISO(next.year, next.month, next.day, ANCHOR_HOUR, 0);
    }
    return laWallTimeToISO(year, month, day, hour, 0);
  }

  // Future (or past) calendar day → 17:00 that day
  return laWallTimeToISO(year, month, day, ANCHOR_HOUR, 0);
}

export function computeKRBatchStartISO(now = new Date()): string {
  const p = getLAParts(now);
  if (p.hour < ANCHOR_HOUR) {
    return laWallTimeToISO(p.year, p.month, p.day, ANCHOR_HOUR, 0);
  }
  let hour = p.minute > 0 ? p.hour + 1 : p.hour;
  if (p.minute === 0 && p.hour >= ANCHOR_HOUR) hour = p.hour;
  if (hour >= 24) {
    const next = addCalendarDays(p.year, p.month, p.day, 1);
    return laWallTimeToISO(next.year, next.month, next.day, ANCHOR_HOUR, 0);
  }
  return laWallTimeToISO(p.year, p.month, p.day, hour, 0);
}

/**
 * Spread posts across days from startISO.
 * maxPerDay posts per LA calendar day, min 3h gap, new day starts 17:00.
 */
export function buildDaySpreadSlots(
  startISO: string,
  count: number,
  maxPerDay = 5
): string[] {
  if (count <= 0) return [];
  const slots: string[] = [];
  let cursor = new Date(startISO).getTime();
  let dayCount = 0;
  let dayStartParts = getLAParts(new Date(cursor));

  for (let i = 0; i < count; i++) {
    if (dayCount >= maxPerDay) {
      // next calendar day 17:00
      const next = addCalendarDays(
        dayStartParts.year,
        dayStartParts.month,
        dayStartParts.day,
        1
      );
      cursor = new Date(
        laWallTimeToISO(next.year, next.month, next.day, ANCHOR_HOUR, 0)
      ).getTime();
      dayStartParts = getLAParts(new Date(cursor));
      dayCount = 0;
    }

    if (i > 0 && dayCount > 0) {
      cursor += MIN_GAP_MS;
    }

    slots.push(new Date(cursor).toISOString());
    dayCount += 1;
  }
  return slots;
}

export function fallbackSlots(startISO: string, count: number): string[] {
  return buildDaySpreadSlots(startISO, count, 5);
}

export async function assignSlotsWithGrok(
  posts: { id: string; content: string }[],
  startISO: string,
  xaiKey: string,
  maxPerDay = 5
): Promise<string[]> {
  if (posts.length === 0) return [];

  // Prefer deterministic day-spread; Grok optional refinement kept light
  const base = buildDaySpreadSlots(startISO, posts.length, maxPerDay);

  const system = `Assign X post times America/Los_Angeles.
Rules: first at/after ${startISO}; min 3h gap; max ${maxPerDay} posts per calendar day; new day from 17:00.
Return same order ISO UTC. JSON only: { "times": ["..."] }`;

  const user = `Refine ${posts.length} times (keep day spread).
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

    const startMs = new Date(startISO).getTime();
    const fixed: string[] = [];
    let last = startMs - MIN_GAP_MS;

    for (let i = 0; i < times.length; i++) {
      let ms = new Date(times[i]).getTime();
      if (isNaN(ms) || ms < startMs)
        ms = Math.max(startMs, last + MIN_GAP_MS);
      if (ms < last + MIN_GAP_MS) ms = last + MIN_GAP_MS;
      fixed.push(new Date(ms).toISOString());
      last = ms;
    }
    return fixed;
  } catch {
    return base;
  }
}
