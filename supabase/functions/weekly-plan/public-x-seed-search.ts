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
};

const OPERATOR_HANDLE = "Seung4680";

export const PUBLIC_SEED_MIN_LIKES = 80;
export const PUBLIC_SEED_MIN_REPLIES = 20;

export function meetsPublicSeedEngagement(likes: number, replies: number): boolean {
  return Number(likes || 0) >= PUBLIC_SEED_MIN_LIKES || Number(replies || 0) >= PUBLIC_SEED_MIN_REPLIES;
}

const AD_OR_BAIT =
  /지금\s*가입|프로필\s*링크|바이오에\s*링크|한정\s*할인|무료\s*증정|DM\s*주세요|클릭\s*해서\s*구매/i;

export function isPublicSeedAdOrBait(text: string): boolean {
  return AD_OR_BAIT.test(String(text || ""));
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
    return rows
      .map((t: any) => {
        const metrics = t?.public_metrics || {};
        return {
          text: String(t?.text || "").trim(),
          created_at: t?.created_at ? String(t.created_at) : undefined,
          id: t?.id ? String(t.id) : undefined,
          likes: Number(metrics.like_count) || 0,
          replies: Number(metrics.reply_count) || 0,
        };
      })
      .filter((p: OfficialPublicPost) => {
        if ((p.text || "").length < 20) return false;
        if (isPublicSeedAdOrBait(p.text || "")) return false;
        return meetsPublicSeedEngagement(p.likes || 0, p.replies || 0);
      })
      .slice(0, 80);
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
