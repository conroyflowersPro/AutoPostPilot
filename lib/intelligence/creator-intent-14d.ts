/**
 * 14-Day Creator Intent from X Sync activities (no new DB / no extra paid API).
 * Uses existing account_activities rows within last 14 days.
 *
 * Publishing Intent ≠ Reply attention.
 * REPOST is reference only — never strong endorsement.
 */

export type ActivityPostType = "ORIGINAL" | "QUOTE" | "REPLY" | "REPOST" | "UNKNOWN";

export type CreatorActivityRow = {
  text_body?: string | null;
  post_type?: string | null;
  action_type?: string | null;
  published_at?: string | null;
  origin?: string | null;
  system_origin_class?: string | null;
  meta?: Record<string, unknown> | null;
};

export type InterestCluster =
  | "FSD"
  | "CYBERTRUCK"
  | "ROBOTAXI"
  | "AI_TECH"
  | "GAMING"
  | "LAFC"
  | "MUSK_DISCOURSE"
  | "DAILY"
  | "OTHER";

export type IntentStrength = "STRONG" | "MEDIUM" | "WEAK";

export type ClusterIntent = {
  cluster: InterestCluster;
  strength: IntentStrength;
  publishing_score: number;
  reply_attention_score: number;
  original_count: number;
  quote_count: number;
  reply_count: number;
  repost_count: number;
  sample_subjects: string[];
};

export type CreatorIntent14d = {
  window_days: 14;
  from_iso: string;
  to_iso: string;
  counts: {
    ORIGINAL: number;
    QUOTE: number;
    REPLY: number;
    REPOST: number;
    OTHER: number;
  };
  by_cluster: ClusterIntent[];
  interest_mix_weights: Partial<Record<InterestCluster, number>>;
  publishing_interests: InterestCluster[];
  reply_attention: InterestCluster[];
  notes: string[];
};

const CLUSTER_PATTERNS: Array<{ cluster: InterestCluster; re: RegExp }> = [
  { cluster: "FSD", re: /fsd|자율\s*주행|오토파일럿|차선|보행자|합류|공사\s*구간|감독/i },
  { cluster: "CYBERTRUCK", re: /cybertruck|사이버\s*트럭|적재|충전|슈퍼차저|스케일|주차/i },
  { cluster: "ROBOTAXI", re: /robotaxi|로보\s*택시|cybercab|커브사이드|주정차|승하차|회전율/i },
  { cluster: "AI_TECH", re: /\bai\b|그록|grok|llm|프롬프트|요약\s*도구|초안/i },
  { cluster: "GAMING", re: /게임|컨트롤러|스틱|패치|한\s*판|로그라이크/i },
  { cluster: "LAFC", re: /lafc|bmo|직관|손흥민|\bson\b|mls/i },
  { cluster: "MUSK_DISCOURSE", re: /머스크|elon|musk|로드맵|비전/i },
];

export function classifyInterestCluster(text: string): InterestCluster {
  const t = String(text || "");
  for (const { cluster, re } of CLUSTER_PATTERNS) {
    if (re.test(t)) return cluster;
  }
  if (/일상|퇴근|커피|날씨|개인/i.test(t)) return "DAILY";
  return "OTHER";
}

export function normalizePostType(row: CreatorActivityRow): ActivityPostType {
  const t = String(row.post_type || row.action_type || "").toUpperCase();
  if (t === "ORIGINAL" || t === "QUOTE" || t === "REPLY" || t === "REPOST") return t;
  const body = String(row.text_body || "");
  if (/^rt\s|rt @/i.test(body)) return "REPOST";
  return "UNKNOWN";
}

export function isHandmadeCandidate(row: CreatorActivityRow): boolean {
  const soc = String(row.system_origin_class || "").toUpperCase();
  if (soc && /APP|SYSTEM|AUTOPOST|FEDICA_AUTO|GENERATED/.test(soc)) return false;
  return true;
}

function strengthFromPublishing(score: number, originals: number): IntentStrength {
  if (originals >= 2 || score >= 6) return "STRONG";
  if (originals >= 1 || score >= 3) return "MEDIUM";
  return "WEAK";
}

export function analyzeCreatorIntent14d(
  rows: CreatorActivityRow[],
  now: Date = new Date()
): CreatorIntent14d {
  const to = now;
  const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const from_iso = from.toISOString();
  const to_iso = to.toISOString();
  const counts = { ORIGINAL: 0, QUOTE: 0, REPLY: 0, REPOST: 0, OTHER: 0 };
  type Acc = {
    publishing: number;
    reply: number;
    original: number;
    quote: number;
    reply_n: number;
    repost: number;
    samples: string[];
  };
  const acc = new Map<InterestCluster, Acc>();
  const ensure = (c: InterestCluster): Acc => {
    if (!acc.has(c)) {
      acc.set(c, { publishing: 0, reply: 0, original: 0, quote: 0, reply_n: 0, repost: 0, samples: [] });
    }
    return acc.get(c)!;
  };
  for (const row of rows) {
    if (!isHandmadeCandidate(row)) continue;
    const pub = row.published_at ? new Date(row.published_at) : null;
    if (pub && (pub < from || pub > to)) continue;
    const pt = normalizePostType(row);
    const text = String(row.text_body || "").trim();
    if (!text) continue;
    const cluster = classifyInterestCluster(text);
    const a = ensure(cluster);
    const snippet = text.slice(0, 80);
    if (pt === "ORIGINAL") {
      counts.ORIGINAL += 1;
      a.original += 1;
      a.publishing += 3;
      if (a.samples.length < 3) a.samples.push(snippet);
    } else if (pt === "QUOTE") {
      counts.QUOTE += 1;
      a.quote += 1;
      a.publishing += text.length >= 40 ? 2 : 1;
      if (a.samples.length < 3) a.samples.push(snippet);
    } else if (pt === "REPLY") {
      counts.REPLY += 1;
      a.reply_n += 1;
      a.reply += 1;
    } else if (pt === "REPOST") {
      counts.REPOST += 1;
      a.repost += 1;
    } else {
      counts.OTHER += 1;
    }
  }
  const by_cluster: ClusterIntent[] = [];
  for (const [cluster, a] of acc.entries()) {
    by_cluster.push({
      cluster,
      strength: strengthFromPublishing(a.publishing, a.original),
      publishing_score: a.publishing,
      reply_attention_score: a.reply,
      original_count: a.original,
      quote_count: a.quote,
      reply_count: a.reply_n,
      repost_count: a.repost,
      sample_subjects: a.samples,
    });
  }
  by_cluster.sort((x, y) => y.publishing_score - x.publishing_score);
  const totalPub = by_cluster.reduce((s, c) => s + c.publishing_score, 0);
  const interest_mix_weights: Partial<Record<InterestCluster, number>> = {};
  if (totalPub > 0) {
    for (const c of by_cluster) {
      if (c.publishing_score > 0) {
        interest_mix_weights[c.cluster] = Math.round((c.publishing_score / totalPub) * 1000) / 1000;
      }
    }
  }
  const publishing_interests = by_cluster
    .filter((c) => c.publishing_score > 0 && (c.strength === "STRONG" || c.strength === "MEDIUM"))
    .map((c) => c.cluster);
  const pubSet = new Set(publishing_interests);
  const reply_attention = by_cluster
    .filter((c) => c.reply_attention_score > 0)
    .sort((a, b) => b.reply_attention_score - a.reply_attention_score)
    .map((c) => c.cluster)
    .filter((c) => !pubSet.has(c) || (acc.get(c)?.publishing || 0) === 0);
  const notes: string[] = [];
  notes.push("REPLY counts never boost publishing_score");
  notes.push("REPOST is reference-only");
  if (counts.REPLY > counts.ORIGINAL * 3 && counts.ORIGINAL > 0) {
    notes.push("REPLY>>ORIGINAL volume — reply_attention isolated from publishing_interests");
  }
  if (totalPub === 0) {
    notes.push("No ORIGINAL/QUOTE publishing signal in 14d — interest mix falls back to planner defaults");
  }
  return {
    window_days: 14,
    from_iso,
    to_iso,
    counts,
    by_cluster,
    interest_mix_weights,
    publishing_interests,
    reply_attention,
    notes,
  };
}

export const DEFAULT_INTEREST_MIX: Record<string, number> = {
  FSD: 28,
  CYBERTRUCK: 18,
  ROBOTAXI: 18,
  AI_TECH: 10,
  GAMING: 8,
  LAFC: 8,
  MUSK_DISCOURSE: 5,
  DAILY: 5,
};

export function blendInterestMix(
  defaults: Record<string, number> = DEFAULT_INTEREST_MIX,
  intent: CreatorIntent14d | null,
  intent_influence = 0.25
): Record<string, number> {
  const inf = Math.max(0, Math.min(0.35, intent_influence));
  const keys = new Set([...Object.keys(defaults), ...Object.keys(intent?.interest_mix_weights || {})]);
  const out: Record<string, number> = {};
  let sum = 0;
  for (const k of keys) {
    const d = Number(defaults[k] || 0);
    const w = Number(intent?.interest_mix_weights?.[k as InterestCluster] || 0) * 100;
    const v = d * (1 - inf) + w * inf;
    out[k] = v;
    sum += v;
  }
  if (sum <= 0) return { ...defaults };
  for (const k of Object.keys(out)) out[k] = Math.round((out[k] / sum) * 1000) / 10;
  return out;
}

export function clusterPriorityFromMix(
  mix: Record<string, number>,
  cluster: string
): number {
  return Number(mix[String(cluster).toUpperCase()] || mix[cluster] || 0);
}
