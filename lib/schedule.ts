/**
 * Korean track scheduling rules (America/Los_Angeles)
 * - Anchor start: 17:00 local
 * - If past 17:00, start at next full hour
 * - Minimum 3 hours between posts
 * - Specialized Grok may refine slots for X algorithm
 */

const TZ = "America/Los_Angeles";
const MODEL = "grok-4.5";

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

export function computeKRBatchStartISO(now = new Date()): string {
  const p = getLAParts(now);
  const anchorHour = 17;

  if (p.hour < anchorHour) {
    return laWallTimeToISO(p.year, p.month, p.day, anchorHour, 0);
  }

  let hour = p.minute > 0 ? p.hour + 1 : p.hour;
  let day = p.day;
  let month = p.month;
  let year = p.year;

  if (p.minute === 0 && p.hour >= anchorHour) {
    hour = p.hour;
  }

  if (hour >= 24) {
    hour = 0;
    const tmp = new Date(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00Z`
    );
    tmp.setUTCDate(tmp.getUTCDate() + 1);
    const tp = getLAParts(tmp);
    year = tp.year;
    month = tp.month;
    day = tp.day;
    hour = hour % 24;
  }

  return laWallTimeToISO(year, month, day, hour, 0);
}

export function fallbackSlots(startISO: string, count: number): string[] {
  const slots: string[] = [];
  let t = new Date(startISO).getTime();
  for (let i = 0; i < count; i++) {
    slots.push(new Date(t).toISOString());
    t += 3 * 60 * 60 * 1000;
  }
  return slots;
}

export async function assignSlotsWithGrok(
  posts: { id: string; content: string }[],
  startISO: string,
  xaiKey: string
): Promise<string[]> {
  if (posts.length === 0) return [];

  const system = `You are a specialized Growth & Content Agent for @Seung4680.
Assign optimal X posting times in America/Los_Angeles for maximum early engagement.

Rules:
- First post at or after ${startISO}
- Minimum 3 hours between consecutive posts
- Prefer X high-activity windows; avoid dead hours when possible
- ISO 8601 UTC times, one per post, same order

JSON only: { "times": ["..."] }`;

  const user = `Assign ${posts.length} times from ${startISO} (min 3h gap).
${posts.map((p, i) => `${i + 1}. ${p.id} | ${p.content.slice(0, 100)}`).join("\n")}`;

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
        temperature: 0.3,
      }),
    });

    if (!res.ok) throw new Error("Grok schedule API failed");

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    const times: string[] = parsed.times || [];

    if (times.length !== posts.length) {
      return fallbackSlots(startISO, posts.length);
    }

    const startMs = new Date(startISO).getTime();
    const fixed: string[] = [];
    let last = startMs - 3 * 60 * 60 * 1000;

    for (let i = 0; i < times.length; i++) {
      let ms = new Date(times[i]).getTime();
      if (isNaN(ms) || ms < startMs)
        ms = Math.max(startMs, last + 3 * 60 * 60 * 1000);
      if (ms < last + 3 * 60 * 60 * 1000) ms = last + 3 * 60 * 60 * 1000;
      fixed.push(new Date(ms).toISOString());
      last = ms;
    }
    return fixed;
  } catch {
    return fallbackSlots(startISO, posts.length);
  }
}
