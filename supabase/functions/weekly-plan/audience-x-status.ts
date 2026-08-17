/**
 * Audience DNA status for Creator DNA only.
 * Does not decide RETURN/BRIDGE or editorial types.
 */
export type AudienceDayPulse = {
  d: string;
  analytics_originals: number;
  sync_originals: number;
};

export type AudienceXStatus = {
  analytics_from: string;
  analytics_to: string;
  analytics_originals: number;
  sync_gap_originals: number;
  lived_scene_count: number;
  days: AudienceDayPulse[];
  sync_gap_excerpts: Array<{ d: string; excerpt: string }>;
};

function ymd(iso: string): string {
  const raw = String(iso || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw.slice(0, 10);
  return new Date(parsed).toISOString().slice(0, 10);
}

function excerpt(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 72);
}

export function isSyncOriginal(row: {
  action_type?: string;
  post_type?: string;
  features?: { isReply?: boolean };
}): boolean {
  const action = String(row.action_type || row.post_type || "").toUpperCase();
  if (/REPLY|REPOST|RETWEET/.test(action)) return false;
  if (row.features?.isReply === true) return false;
  return !action || /ORIGINAL|QUOTE|UNKNOWN/.test(action);
}

export function buildAudienceXStatus(args: {
  analyticsFrom?: string;
  analyticsTo?: string;
  analyticsPosts: Array<{ post_id?: string | null; published_at?: string; content?: string }>;
  syncPosts: Array<{
    x_post_id?: string | null;
    published_at?: string;
    text_body?: string;
    action_type?: string;
    post_type?: string;
  }>;
}): AudienceXStatus {
  const analyticsIds = new Set(
    args.analyticsPosts.map((p) => String(p.post_id || "")).filter(Boolean),
  );
  const byDay = new Map<string, AudienceDayPulse>();
  const bump = (d: string) => {
    if (!d) return;
    const cur = byDay.get(d) || { d, analytics_originals: 0, sync_originals: 0 };
    byDay.set(d, cur);
    return cur;
  };
  for (const row of args.analyticsPosts) {
    const d = ymd(String(row.published_at || ""));
    const cur = bump(d);
    if (cur) cur.analytics_originals += 1;
  }
  const gap: Array<{ d: string; excerpt: string }> = [];
  const seenLived = new Set<string>([...analyticsIds]);
  for (const row of args.syncPosts) {
    if (!isSyncOriginal(row)) continue;
    const d = ymd(String(row.published_at || ""));
    const id = String(row.x_post_id || "");
    const cur = bump(d);
    if (cur) cur.sync_originals += 1;
    if (id && analyticsIds.has(id)) continue;
    if (id) seenLived.add(id);
    else seenLived.add(`sync:${d}|${excerpt(String(row.text_body || ""))}`);
    gap.push({ d, excerpt: excerpt(String(row.text_body || "")) });
  }
  const dates = [...byDay.keys()].sort();
  return {
    analytics_from: ymd(String(args.analyticsFrom || dates[0] || "")),
    analytics_to: ymd(String(args.analyticsTo || dates[dates.length - 1] || "")),
    analytics_originals: args.analyticsPosts.length,
    sync_gap_originals: gap.length,
    lived_scene_count: seenLived.size,
    days: dates.map((d) => byDay.get(d)!),
    sync_gap_excerpts: gap.slice(0, 40),
  };
}

export function audienceStatusBlock(status: AudienceXStatus): string {
  return [
    "AUDIENCE DNA (X account status only). Do not decide slots. Do not overwrite Creator DNA.",
    `Analytics window ${status.analytics_from || "?"}–${status.analytics_to || "?"} · originals ${status.analytics_originals}`,
    `Sync-gap originals (not in Analytics ids) ${status.sync_gap_originals}`,
    `Lived scene count (Analytics + sync gap, unique) ${status.lived_scene_count}`,
    "Handmade posts are uncertain climate. Do not leave empty AP days for them. Do not reduce handmade.",
    status.sync_gap_excerpts.length
      ? `Sync gap excerpts: ${status.sync_gap_excerpts.map((g) => `${g.d}:${g.excerpt}`).join(" · ")}`
      : "Sync gap excerpts: none",
  ].join("\n");
}
