/**
 * Public X seed search — official recent volume when a token exists,
 * plus Grok x_search date windows. Excludes the operator handle.
 * Does not know creator-lived Analytics episodes.
 * Does not judge RETURN/BRIDGE/REACH or editorial type.
 */
export type OfficialPublicPost = {
  text: string;
  created_at?: string;
  id?: string;
  likes?: number;
  replies?: number;
  impressions?: number;
};

const OPERATOR_HANDLE = "Seung4680";

export const PUBLIC_SEED_MIN_REPLIES = 20;
export const PUBLIC_SEED_SUPPLEMENT_IMPRESSIONS = 50_000;
export const PUBLIC_SEED_REPLY_POOL_ENOUGH = 8;

export function meetsPublicSeedPrimary(replies: number): boolean {
  return Number(replies || 0) >= PUBLIC_SEED_MIN_REPLIES;
}

export function meetsPublicSeedSupplement(impressions: number): boolean {
  return Number(impressions || 0) >= PUBLIC_SEED_SUPPLEMENT_IMPRESSIONS;
}

/** Primary: replies. Supplement impressions only when the caller says the reply pool is short. */
export function meetsPublicSeedEngagement(
  replies: number,
  impressions = 0,
  allowImpressionSupplement = false,
): boolean {
  if (meetsPublicSeedPrimary(replies)) return true;
  if (allowImpressionSupplement && meetsPublicSeedSupplement(impressions)) return true;
  return false;
}

const AD_OR_BAIT =
  /지금\s*가입|프로필\s*링크|바이오에\s*링크|한정\s*할인|무료\s*증정|DM\s*주세요|클릭\s*해서\s*구매/i;

export function isPublicSeedAdOrBait(text: string): boolean {
  return AD_OR_BAIT.test(String(text || ""));
}

export function isContextlessShort(text: string): boolean {
  const t = String(text || "").replace(/https?:\/\/\S+/gi, "").trim();
  return t.length < 40;
}

export function isRetweetHeavy(text: string): boolean {
  const t = String(text || "").trim();
  return /^rt\s+@/i.test(t) || /^rt:/i.test(t);
}

function keepBase(p: OfficialPublicPost): boolean {
  if (isContextlessShort(p.text || "")) return false;
  if (isPublicSeedAdOrBait(p.text || "")) return false;
  if (isRetweetHeavy(p.text || "")) return false;
  return true;
}

export function filterOfficialPublicPosts(rows: OfficialPublicPost[]): OfficialPublicPost[] {
  const usable = rows.filter(keepBase);
  const primary = usable.filter((p) => meetsPublicSeedPrimary(p.replies || 0));
  if (primary.length >= PUBLIC_SEED_REPLY_POOL_ENOUGH) return primary.slice(0, 80);
  const extra = usable.filter(
    (p) => !meetsPublicSeedPrimary(p.replies || 0) && meetsPublicSeedSupplement(p.impressions || 0),
  );
  return [...primary, ...extra].slice(0, 80);
}

export async function fetchOfficialPublicPosts(args: {
  accessToken?: string;
  maxResults?: number;
}): Promise<OfficialPublicPost[]> {
  const token = String(args.accessToken || "").trim();
  if (!token) return [];
  const q = new URLSearchParams({
    query: `-from:${OPERATOR_HANDLE} -is:retweet lang:ko`,
    max_results: String(Math.min(100, Math.max(10, args.maxResults || 100))),
    "tweet.fields": "created_at,text,public_metrics",
  });
  try {
    const res = await fetch(`https://api.x.com/2/tweets/search/recent?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    const rows = Array.isArray(body?.data) ? body.data : [];
    const mapped: OfficialPublicPost[] = rows.map((t: any) => {
      const metrics = t?.public_metrics || {};
      return {
        text: String(t?.text || "").trim(),
        created_at: t?.created_at ? String(t.created_at) : undefined,
        id: t?.id ? String(t.id) : undefined,
        likes: Number(metrics.like_count) || 0,
        replies: Number(metrics.reply_count) || 0,
        impressions: Number(metrics.impression_count) || 0,
      };
    });
    return filterOfficialPublicPosts(mapped);
  } catch {
    return [];
  }
}

export async function loadEdgeXAccessToken(supabase: any): Promise<string> {
  if (!supabase) return "";
  try {
    const { data } = await supabase
      .from("account_connections")
      .select("access_token")
      .limit(1)
      .maybeSingle();
    return String(data?.access_token || "").trim();
  } catch {
    return "";
  }
}

export { OPERATOR_HANDLE };
