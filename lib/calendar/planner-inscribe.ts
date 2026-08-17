/**
 * Planner inscription for the queue month calendar.
 * Writes X-account 현황 counts only. Does not plan slots, mix, or posting times.
 * Source is the last 「지금 동기화」 rows, never a login fetch and never leftover drafts.
 */

export type CalendarKindKey = "handmade" | "ap" | "quote" | "repost" | "booked";

export type CalendarKindCount = {
  key: CalendarKindKey;
  label: string;
  n: number;
};

export type InscribedDay = {
  date: string;
  kinds: CalendarKindCount[];
};

export type ActivityForInscribe = {
  activity_date?: string | null;
  published_at?: string | null;
  action_type?: string | null;
  post_type?: string | null;
  system_origin_class?: string | null;
  origin?: string | null;
};

const KIND_LABEL: Record<CalendarKindKey, string> = {
  handmade: "수제",
  ap: "AP",
  quote: "인용",
  repost: "재게시",
  booked: "예약",
};

const AP_CLASS = /AP_PIPELINE|FEDICA_AUTO|AUTOPOST|GENERATED/;

export function ptDateKey(isoOrDate: string): string {
  const raw = String(isoOrDate || "").trim();
  if (!raw) return "";
  const parsed = Date.parse(raw.length <= 10 ? `${raw}T12:00:00Z` : raw);
  if (!Number.isFinite(parsed)) return raw.slice(0, 10);
  return new Date(parsed).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export function isApOriginClass(value: string | null | undefined): boolean {
  return AP_CLASS.test(String(value || "").toUpperCase());
}

export function classifySyncedAction(row: ActivityForInscribe): CalendarKindKey | null {
  const action = String(row.action_type || row.post_type || "").toUpperCase();
  if (action === "REPLY" || action === "SKIP") return null;
  if (action === "QUOTE") return "quote";
  if (action === "REPOST" || action === "RETWEET") return "repost";
  if (action && action !== "ORIGINAL" && action !== "UNKNOWN") return null;
  return isApOriginClass(row.system_origin_class) ? "ap" : "handmade";
}

export type ApOriginHint = {
  id?: string | null;
  content?: string | null;
  final_text?: string | null;
  pipeline_id?: string | null;
  fedica_post_id?: string | null;
  x_post_id?: string | null;
  tweet_id?: string | null;
  external_id?: string | null;
  strategy_json?: Record<string, unknown> | null;
  schedule_provider?: string | null;
};

export function normalizePostText(text: string): string {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function rowLooksLikeApPipeline(row: ApOriginHint): boolean {
  const soc = String((row.strategy_json as any)?.system_origin_class || "").toUpperCase();
  if (AP_CLASS.test(soc)) return true;
  if (String(row.pipeline_id || "") === "42303") return true;
  if (/fedica/i.test(String(row.schedule_provider || ""))) return true;
  return false;
}

export function classifyXPostOrigin(
  xPostId: string,
  text: string,
  apRows: ApOriginHint[],
): "USER_DIRECT" | "AP_PIPELINE" {
  const id = String(xPostId || "").trim();
  const body = normalizePostText(text);
  for (const row of apRows || []) {
    if (!rowLooksLikeApPipeline(row)) continue;
    const ids = [
      row.fedica_post_id,
      row.x_post_id,
      row.tweet_id,
      row.external_id,
      (row.strategy_json as any)?.x_post_id,
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    if (id && ids.includes(id)) return "AP_PIPELINE";
    const stored = normalizePostText(String(row.content || row.final_text || ""));
    if (body.length >= 20 && stored.length >= 20 && (body === stored || body.startsWith(stored.slice(0, 80)) || stored.startsWith(body.slice(0, 80)))) {
      return "AP_PIPELINE";
    }
  }
  return "USER_DIRECT";
}

export function inscribeMonthFromActivities(
  rows: ActivityForInscribe[],
  year: number,
  month1to12: number,
): InscribedDay[] {
  const prefix = `${year}-${String(month1to12).padStart(2, "0")}-`;
  const bag = new Map<string, Record<CalendarKindKey, number>>();
  for (const row of rows || []) {
    const key = ptDateKey(String(row.published_at || row.activity_date || ""));
    if (!key.startsWith(prefix)) continue;
    const kind = classifySyncedAction(row);
    if (!kind) continue;
    const cur = bag.get(key) || { handmade: 0, ap: 0, quote: 0, repost: 0, booked: 0 };
    cur[kind] += 1;
    bag.set(key, cur);
  }
  const days: InscribedDay[] = [];
  for (const [date, counts] of [...bag.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const kinds: CalendarKindCount[] = (Object.keys(KIND_LABEL) as CalendarKindKey[])
      .filter((k) => counts[k] > 0)
      .map((k) => ({ key: k, label: KIND_LABEL[k], n: counts[k] }));
    if (kinds.length) days.push({ date, kinds });
  }
  return days;
}

/** Upcoming AP posts that already have a wall-clock time. */
export function mergeBookedScheduleDays(
  days: InscribedDay[],
  rows: { scheduled_at?: string | null }[],
  year: number,
  month1to12: number,
): InscribedDay[] {
  const prefix = `${year}-${String(month1to12).padStart(2, "0")}-`;
  const bag = new Map<string, Record<CalendarKindKey, number>>();
  for (const d of days) {
    const cur = { handmade: 0, ap: 0, quote: 0, repost: 0, booked: 0 };
    for (const k of d.kinds) cur[k.key] = k.n;
    bag.set(d.date, cur);
  }
  for (const row of rows || []) {
    const key = ptDateKey(String(row.scheduled_at || ""));
    if (!key.startsWith(prefix)) continue;
    const cur = bag.get(key) || { handmade: 0, ap: 0, quote: 0, repost: 0, booked: 0 };
    cur.booked += 1;
    bag.set(key, cur);
  }
  const out: InscribedDay[] = [];
  for (const [date, counts] of [...bag.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const kinds: CalendarKindCount[] = (Object.keys(KIND_LABEL) as CalendarKindKey[])
      .filter((k) => counts[k] > 0)
      .map((k) => ({ key: k, label: KIND_LABEL[k], n: counts[k] }));
    if (kinds.length) out.push({ date, kinds });
  }
  return out;
}
