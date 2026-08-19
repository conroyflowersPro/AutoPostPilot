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

export type OfficialSearchStatus = "ok" | "missing_token" | "http_error" | "exception";

export type OfficialSearchResult = {
  posts: OfficialPublicPost[];
  status: OfficialSearchStatus;
  error?: string;
  queries?: string[];
};

export type EdgeXTokenStatus =
  | "ok"
  | "missing"
  | "expired_no_refresh"
  | "refresh_failed"
  | "refresh_unconfigured";

export type EdgeXTokenResult = {
  token: string;
  status: EdgeXTokenStatus;
  error?: string;
};

const OPERATOR_HANDLE = "Seung4680";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";

export const PUBLIC_SEED_MIN_REPLIES = 20;
export const PUBLIC_SEED_SUPPLEMENT_IMPRESSIONS = 50_000;
export const PUBLIC_SEED_REPLY_POOL_ENOUGH = 8;

/** Korean field slices for x_search and official recent search. Not dates-only. */
export const PUBLIC_KO_QUERY_SLICES = [
  "충전 OR 슈퍼차저 OR 대기줄",
  "FSD OR 오토파일럿 OR 자율주행",
  "주차 OR 교차로 OR 차선",
  "테슬라 OR 사이버트럭",
  "그록 OR 챗GPT OR AI",
  "알림 OR 업데이트 OR 화면",
  "직관 OR 축구 OR 경기",
] as const;

export function publicQuerySlice(index = 0): string {
  const n = PUBLIC_KO_QUERY_SLICES.length;
  return PUBLIC_KO_QUERY_SLICES[((Number(index) || 0) % n + n) % n];
}

export function publicDateSlice(index = 0, now = new Date()): { from: string; to: string; key: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const windows = [
    { fromDays: 2, toDays: 0, key: "last2" },
    { fromDays: 4, toDays: 2, key: "d2to4" },
    { fromDays: 7, toDays: 4, key: "d4to7" },
  ];
  const w = windows[((Number(index) || 0) % windows.length + windows.length) % windows.length];
  return {
    from: iso(new Date(now.getTime() - w.fromDays * 86400000)),
    to: iso(new Date(now.getTime() - w.toDays * 86400000)),
    key: w.key,
  };
}

export function officialSearchQuery(sliceIndex = 0): string {
  return `-from:${OPERATOR_HANDLE} -is:retweet lang:ko (${publicQuerySlice(sliceIndex)})`;
}

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

function readEnv(name: string): string {
  try {
    const deno = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno;
    if (deno?.env?.get) return String(deno.env.get(name) || "").trim();
  } catch {
    /* Node test path */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
    return String(proc?.env?.[name] || "").trim();
  } catch {
    return "";
  }
}

function basicAuth(id: string, secret: string): string {
  const raw = `${id}:${secret}`;
  const g = globalThis as { btoa?: (s: string) => string; Buffer?: { from: (s: string) => { toString: (enc: string) => string } } };
  if (typeof g.btoa === "function") return g.btoa(raw);
  if (g.Buffer) return g.Buffer.from(raw).toString("base64");
  return "";
}

function mapOfficialRow(t: any): OfficialPublicPost {
  const metrics = t?.public_metrics || {};
  return {
    text: String(t?.text || "").trim(),
    created_at: t?.created_at ? String(t.created_at) : undefined,
    id: t?.id ? String(t.id) : undefined,
    likes: Number(metrics.like_count) || 0,
    replies: Number(metrics.reply_count) || 0,
    impressions: Number(metrics.impression_count) || 0,
  };
}

async function searchOfficialSlice(args: {
  token: string;
  query: string;
  maxResults: number;
}): Promise<{ posts: OfficialPublicPost[]; error?: string }> {
  const q = new URLSearchParams({
    query: args.query,
    max_results: String(Math.min(100, Math.max(10, args.maxResults))),
    "tweet.fields": "created_at,text,public_metrics",
  });
  const res = await fetch(`https://api.x.com/2/tweets/search/recent?${q}`, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { posts: [], error: String(body?.title || body?.detail || `http_${res.status}`).slice(0, 160) };
  }
  const rows = Array.isArray(body?.data) ? body.data : [];
  return { posts: rows.map(mapOfficialRow) };
}

export async function fetchOfficialPublicPosts(args: {
  accessToken?: string;
  maxResults?: number;
  sliceIndex?: number;
}): Promise<OfficialSearchResult> {
  const token = String(args.accessToken || "").trim();
  if (!token) return { posts: [], status: "missing_token" };
  const start = Number(args.sliceIndex || 0);
  const queries = [officialSearchQuery(start), officialSearchQuery(start + 1)];
  const seen = new Set<string>();
  const mapped: OfficialPublicPost[] = [];
  let lastError = "";
  try {
    for (const query of queries) {
      const page = await searchOfficialSlice({
        token,
        query,
        maxResults: args.maxResults || 50,
      });
      if (page.error) lastError = page.error;
      for (const p of page.posts) {
        const key = p.id || p.text;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        mapped.push(p);
      }
    }
    if (!mapped.length && lastError) {
      return { posts: [], status: "http_error", error: lastError, queries };
    }
    return { posts: filterOfficialPublicPosts(mapped), status: "ok", queries };
  } catch (e: any) {
    return {
      posts: [],
      status: "exception",
      error: String(e?.message || "official_search_exception").slice(0, 160),
      queries,
    };
  }
}

async function refreshEdgeAccessToken(refreshToken: string): Promise<{ token: string; refresh?: string; expiresIn?: number } | { error: string }> {
  const clientId = readEnv("X_CLIENT_ID");
  const clientSecret = readEnv("X_CLIENT_SECRET");
  if (!clientId || !clientSecret) return { error: "refresh_unconfigured" };
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    return { error: String(data?.error_description || data?.error || `refresh_http_${res.status}`).slice(0, 160) };
  }
  return {
    token: String(data.access_token),
    refresh: data.refresh_token ? String(data.refresh_token) : undefined,
    expiresIn: Number(data.expires_in) || 7200,
  };
}

/** Load the Edge official-search token. Refresh when a safe path exists. Missing token is allowed. */
export async function loadEdgeXAccessToken(supabase: any): Promise<EdgeXTokenResult> {
  if (!supabase) return { token: "", status: "missing" };
  try {
    const { data } = await supabase
      .from("account_connections")
      .select("id, access_token, refresh_token, token_expires_at")
      .limit(1)
      .maybeSingle();
    const access = String(data?.access_token || "").trim();
    const refresh = String(data?.refresh_token || "").trim();
    const expiresAt = data?.token_expires_at ? new Date(String(data.token_expires_at)).getTime() : 0;
    const fresh = expiresAt > Date.now() + 60_000;
    if (access && (fresh || !expiresAt)) return { token: access, status: "ok" };
    if (!access && !refresh) return { token: "", status: "missing" };
    if (!refresh) return { token: access, status: access ? "ok" : "expired_no_refresh" };
    const next = await refreshEdgeAccessToken(refresh);
    if ("error" in next) {
      if (next.error === "refresh_unconfigured") {
        return { token: access, status: access ? "ok" : "refresh_unconfigured", error: next.error };
      }
      return { token: access, status: "refresh_failed", error: next.error };
    }
    if (data?.id) {
      await supabase
        .from("account_connections")
        .update({
          access_token: next.token,
          refresh_token: next.refresh || refresh,
          token_expires_at: new Date(Date.now() + (next.expiresIn || 7200) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    }
    return { token: next.token, status: "ok" };
  } catch (e: any) {
    return { token: "", status: "missing", error: String(e?.message || "token_load_exception").slice(0, 160) };
  }
}

export function officialTokenStatusKo(status: EdgeXTokenStatus, search?: OfficialSearchStatus): string {
  if (status === "missing") return "공식 X 토큰 없음 · x_search로 추출";
  if (status === "expired_no_refresh") return "공식 X 토큰 만료 · 재연결 필요 · x_search로 추출";
  if (status === "refresh_failed") return "공식 X 토큰 갱신 실패 · x_search로 추출";
  if (status === "refresh_unconfigured") return "공식 X 토큰 갱신 설정 없음 · x_search로 추출";
  if (search === "http_error") return "공식 X 최근검색 HTTP 실패 · x_search로 추출";
  if (search === "exception") return "공식 X 최근검색 예외 · x_search로 추출";
  return "";
}

export { OPERATOR_HANDLE };
