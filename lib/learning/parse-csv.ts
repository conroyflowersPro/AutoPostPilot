import type { MetricOrigin, NormalizedPostMetrics } from "./types";
import { extractFeatures } from "./features";

/** X Analytics Content CSV adapter. Canonical internal model stays stable; other providers add adapters. */
export const ANALYTICS_PRIMARY_ADAPTER = "x_analytics_csv";

/** Flexible header aliases — X Analytics Content CSV first priority */
const ALIASES: Record<string, string[]> = {
  postId: ["post_id", "postid", "id", "tweet_id", "tweetid"],
  content: [
    "post_text", "posttext", "content", "text", "post", "message", "tweet",
    "본문", "내용", "포스트", "게시물",
  ],
  date: [
    "date", "published", "published_at", "publishedat", "created", "datetime",
    "시간", "날짜", "게시일",
  ],
  followersGained: [
    "new_follows", "newfollows", "followers_gained", "followersgained",
    "follower_gain", "new_followers", "팔로워증가", "팔로워", "followers",
  ],
  profileVisits: [
    "profile_visits", "profilevisits", "profile_clicks", "profileclicks",
    "프로필방문", "프로필클릭",
  ],
  bookmarks: ["bookmarks", "bookmark", "saves", "북마크", "저장"],
  replies: ["replies", "reply", "comments", "답글", "댓글", "replies_count"],
  reposts: ["reposts", "retweets", "reposts_count", "리포스트", "리트윗"],
  likes: ["likes", "favorites", "faves", "hearts", "좋아요", "likes_count"],
  impressions: [
    "impressions", "views", "reach", "노출", "조회", "impressions_count",
  ],
  quotes: ["quotes", "quote_posts", "인용", "quotes_count"],
  shares: ["shares", "share", "공유"],
  detailExpands: [
    "detail_expands", "detailexpands", "detail_expand", "detail expands",
  ],
  urlClicks: ["url_clicks", "urlclicks", "url clicks"],
  hashtagClicks: ["hashtag_clicks", "hashtagclicks", "hashtag clicks"],
  permalinkClicks: ["permalink_clicks", "permalinkclicks", "permalink clicks"],
  engagements: ["engagements", "engagement", "참여"],
  revenue: [
    "estimated_revenue", "revenue", "earnings", "estimated revenue", "수익",
  ],
  engagementRate: [
    "engagement_rate", "engagementrate", "eng_rate", "참여율",
  ],
};

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\w가-힣_]/g, "");
}

function findCol(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normHeader);
  for (const a of aliases) {
    const na = normHeader(a);
    const i = normalized.indexOf(na);
    if (i >= 0) return i;
  }
  for (let i = 0; i < normalized.length; i++) {
    for (const a of aliases) {
      const na = normHeader(a);
      if (normalized[i].includes(na) || na.includes(normalized[i])) return i;
    }
  }
  return -1;
}

function parseNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const s = String(v).replace(/[,%\s$]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const joined = rows[i].map(normHeader).join("|");
    if (
      joined.includes("post_text") ||
      joined.includes("impressions") ||
      joined.includes("likes") ||
      joined.includes("views")
    ) {
      return i;
    }
  }
  return 0;
}

export function parseMetricsCsv(
  text: string,
  origin: MetricOrigin = "unknown"
): NormalizedPostMetrics[] {
  const rows = splitCsv(text);
  if (rows.length < 2) return [];

  const headerIdx = findHeaderRow(rows);
  const headers = rows[headerIdx];
  const col = {
    postId: findCol(headers, ALIASES.postId),
    content: findCol(headers, ALIASES.content),
    date: findCol(headers, ALIASES.date),
    followersGained: findCol(headers, ALIASES.followersGained),
    profileVisits: findCol(headers, ALIASES.profileVisits),
    bookmarks: findCol(headers, ALIASES.bookmarks),
    replies: findCol(headers, ALIASES.replies),
    reposts: findCol(headers, ALIASES.reposts),
    likes: findCol(headers, ALIASES.likes),
    impressions: findCol(headers, ALIASES.impressions),
    quotes: findCol(headers, ALIASES.quotes),
    shares: findCol(headers, ALIASES.shares),
    detailExpands: findCol(headers, ALIASES.detailExpands),
    urlClicks: findCol(headers, ALIASES.urlClicks),
    hashtagClicks: findCol(headers, ALIASES.hashtagClicks),
    permalinkClicks: findCol(headers, ALIASES.permalinkClicks),
    engagements: findCol(headers, ALIASES.engagements),
    revenue: findCol(headers, ALIASES.revenue),
    engagementRate: findCol(headers, ALIASES.engagementRate),
  };

  if (col.content < 0 && col.impressions < 0 && col.likes < 0) {
    throw new Error(
      "CSV 헤더를 인식하지 못했습니다. Post text / Impressions / Likes 등이 필요합니다."
    );
  }

  const out: NormalizedPostMetrics[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (idx: number) => (idx >= 0 ? cells[idx] ?? "" : "");
    const snippet = String(get(col.content) || "").trim().slice(0, 800);
    const impressions = parseNum(get(col.impressions));
    const likes = parseNum(get(col.likes));
    if (col.content >= 0 && !snippet && impressions === 0 && likes === 0)
      continue;
    if (col.content < 0 && impressions === 0 && likes === 0) continue;

    let engagementRate: number | null = null;
    if (col.engagementRate >= 0) {
      const e = parseNum(get(col.engagementRate));
      engagementRate = e > 1 ? e / 100 : e;
    } else if (impressions > 0) {
      const eng =
        likes +
        parseNum(get(col.replies)) +
        parseNum(get(col.reposts)) +
        parseNum(get(col.quotes)) +
        parseNum(get(col.bookmarks));
      engagementRate = eng / impressions;
    }

    const dateRaw = String(get(col.date) || "").trim();
    let publishedAt: string | null = null;
    if (dateRaw) {
      const d = new Date(dateRaw);
      publishedAt = Number.isNaN(d.getTime()) ? dateRaw : d.toISOString();
    }

    const features = extractFeatures(snippet || "");

    out.push({
      postId: col.postId >= 0 ? String(get(col.postId) || "").trim() || null : null,
      contentSnippet: snippet || `(row ${r})`,
      publishedAt,
      followersGained: parseNum(get(col.followersGained)),
      profileVisits: parseNum(get(col.profileVisits)),
      bookmarks: parseNum(get(col.bookmarks)),
      replies: parseNum(get(col.replies)),
      reposts: parseNum(get(col.reposts)),
      likes,
      impressions,
      quotes: parseNum(get(col.quotes)),
      shares: parseNum(get(col.shares)),
      detailExpands: parseNum(get(col.detailExpands)),
      urlClicks: parseNum(get(col.urlClicks)),
      hashtagClicks: parseNum(get(col.hashtagClicks)),
      permalinkClicks: parseNum(get(col.permalinkClicks)),
      engagements: parseNum(get(col.engagements)),
      revenue: parseNum(get(col.revenue)),
      engagementRate,
      origin,
      features,
      raw: Object.fromEntries(headers.map((h, i) => [h, cells[i]])),
    });
  }
  return out;
}
