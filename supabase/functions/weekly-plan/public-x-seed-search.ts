/**
 * Public X seed search — official recent volume when a token exists,
 * plus Grok x_search date windows. Excludes the operator handle.
 * Does not know creator-lived Analytics episodes.
 */
export type OfficialPublicPost = { text: string; created_at?: string; id?: string };

const OPERATOR_HANDLE = "Seung4680";

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
      .map((t: any) => ({
        text: String(t?.text || "").trim(),
        created_at: t?.created_at ? String(t.created_at) : undefined,
        id: t?.id ? String(t.id) : undefined,
      }))
      .filter((p: OfficialPublicPost) => p.text.length >= 12)
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
