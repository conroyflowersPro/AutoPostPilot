/**
 * Rolling USER_DIRECT 말투 / 문체 window + slot surface.
 * Discourse-shape variety is judged on the whole unfold (hook, order, ending),
 * not by blacklisting conjunctions. Stats only — never finished-post examples.
 */
import { classifyPlanOrigin } from "./plan-evidence.ts";

export type VoiceActivityRow = {
  text_body?: string | null;
  post_type?: string | null;
  action_type?: string | null;
  published_at?: string | null;
  system_origin_class?: string | null;
  meta?: Record<string, unknown> | null;
};

export type EndingKind = "HAEYO" | "EUMSEUM" | "QUESTION" | "OTHER";

export type VoiceRegister = {
  window_days: number;
  n: number;
  thin: boolean;
  median_chars: number;
  ending_haeyo_rate: number;
  ending_eumseum_rate: number;
  ending_question_rate: number;
  kk_rate: number;
  question_ending_allowed: boolean;
  comparable_n: number;
  comparable_entry_n: number;
  notes: string[];
};

export function isUserDirectOriginal(row: VoiceActivityRow): boolean {
  if (classifyPlanOrigin(row.system_origin_class) !== "USER_DIRECT") return false;
  const pt = String(row.post_type || row.action_type || "").toUpperCase();
  if (pt.includes("REPLY") || pt.includes("REPOST") || pt.includes("RETWEET")) return false;
  return true;
}

function clusterFromText(text: string): string {
  const t = text.toLowerCase();
  if (/fsd|자율|합류|공사|보행/.test(t)) return "FSD";
  if (/cyber|사이버|충전|적재|슈퍼차저/.test(t)) return "CYBERTRUCK";
  if (/robotaxi|로보|커브|승하차/.test(t)) return "ROBOTAXI";
  if (/lafc|bmo|직관|경기/.test(t)) return "LAFC";
  if (/게임|컨트롤러/.test(t)) return "GAMING";
  if (/\bai\b|그록|프롬프트/.test(t)) return "AI_TECH";
  return "DAILY";
}

export function endingKind(text: string): EndingKind {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "OTHER";
  const tail = t.slice(-24);
  if (/[?？]\s*$/.test(t) || /까요[\.…]?\s*$/.test(tail) || /인가[\.…]?\s*$/.test(tail)) return "QUESTION";
  if (/요[\.…]?\s*$/.test(tail) || /네요[\.…]?\s*$/.test(tail) || /예요[\.…]?\s*$/.test(tail)) return "HAEYO";
  if (/음[\.…]?\s*$/.test(tail) || /음슴/.test(tail) || /함[\.…]?\s*$/.test(tail) || /임[\.…]?\s*$/.test(tail)) {
    return "EUMSEUM";
  }
  return "OTHER";
}

function hasKk(text: string): boolean {
  return /ㅋㅋ+|ㅎㅎ+/.test(text);
}

function metricBag(row: VoiceActivityRow): Record<string, number> {
  const meta = row.meta || {};
  const pub = (meta.public_metrics || meta.publicMetrics || {}) as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(pub)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function hasEntry(row: VoiceActivityRow): boolean {
  const m = metricBag(row);
  return (
    (m.reply_count || 0) >= 1 ||
    (m.retweet_count || 0) >= 1 ||
    (m.quote_count || 0) >= 1 ||
    (m.bookmark_count || 0) >= 1
  );
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

function rate(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100) / 100;
}

export function buildUserDirectVoiceWindow(
  rows: VoiceActivityRow[],
  now: Date = new Date(),
): { window_days: 30 | 60; posts: Array<VoiceActivityRow & { text: string; cluster: string }> } {
  const direct = (rows || [])
    .filter(isUserDirectOriginal)
    .map((r) => ({
      ...r,
      text: String(r.text_body || "").trim(),
      cluster: clusterFromText(String(r.text_body || "")),
    }))
    .filter((r) => r.text.length >= 8);

  const inDays = (d: number) => {
    const from = new Date(now.getTime() - d * 24 * 3600 * 1000);
    return direct.filter((r) => {
      if (!r.published_at) return d >= 60;
      const p = new Date(r.published_at);
      return p >= from && p <= now;
    });
  };

  const d30 = inDays(30);
  if (d30.length >= 5) return { window_days: 30, posts: d30 };
  return { window_days: 60, posts: inDays(60) };
}

export function inferSlotVoice(args: {
  rows: VoiceActivityRow[];
  cluster?: string | null;
  editorial_mode?: string | null;
  now?: Date;
}): VoiceRegister {
  const built = buildUserDirectVoiceWindow(args.rows, args.now || new Date());
  const posts = built.posts;
  const n = posts.length;
  const thin = n < 5;
  const lens = posts.map((p) => p.text.length);
  const endings = posts.map((p) => endingKind(p.text));
  const cluster = String(args.cluster || "").toUpperCase();
  const comparable = cluster && cluster !== "OTHER"
    ? posts.filter((p) => p.cluster === cluster)
    : posts;
  const pool = comparable.length >= 2 ? comparable : posts;
  const q = pool.filter((p) => endingKind(p.text) === "QUESTION").length;
  const question_ending_allowed = false;
  const notes: string[] = [];
  notes.push(`USER_DIRECT window ${built.window_days}d n=${n}${thin ? " thin" : ""}`);
  if (pool !== posts) notes.push(`comparable cluster ${cluster} n=${pool.length}`);
  notes.push(
    q > 0
      ? "handmade questions exist as stats only — do not install an engagement-bait closer"
      : "do not install a question for the algorithm; a genuine thinking question inside the thought is allowed",
  );
  const kk = pool.filter((p) => hasKk(p.text)).length;
  if (kk / Math.max(pool.length, 1) < 0.2) notes.push("ㅋㅋ not typical in comparable handmade");
  const entryN = pool.filter((p) => hasEntry(p)).length;
  if (entryN > 0) notes.push(`comparable handmade with reader entry: ${entryN}/${pool.length}`);

  return {
    window_days: built.window_days,
    n,
    thin,
    median_chars: median(lens),
    ending_haeyo_rate: rate(endings.filter((e) => e === "HAEYO").length, n),
    ending_eumseum_rate: rate(endings.filter((e) => e === "EUMSEUM").length, n),
    ending_question_rate: rate(endings.filter((e) => e === "QUESTION").length, n),
    kk_rate: rate(posts.filter((p) => hasKk(p.text)).length, n),
    question_ending_allowed,
    comparable_n: pool.length,
    comparable_entry_n: entryN,
    notes,
  };
}

export type SurfaceEnding = "HAEYO" | "EUMSEUM" | "OTHER";

export type InferredSurface = {
  ending: SurfaceEnding;
  reason: string;
  constraint_line: string;
};

function surfaceLine(ending: SurfaceEnding): string {
  if (ending === "HAEYO") {
    return "THIS POST SURFACE (planner, this slot only): 해요/존칭 ending this time.";
  }
  if (ending === "EUMSEUM") {
    return "THIS POST SURFACE (planner, this slot only): 음슴체 ending this time if it fits the observation.";
  }
  return "THIS POST SURFACE (planner, this slot only): a finished statement that is neither default 해요 nor default 음슴 — not the previous post's ending.";
}

function slotSalt(seedKey?: string | null, slotIndex?: number): number {
  const s = String(seedKey || "") + "#" + String(slotIndex || 0);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Planner decides this slot's 해요/음슴/other.
 * No frozen mix percentage. USER_DIRECT rates are evidence, not a quota.
 * Editorial mode is not a 말투 table.
 */
export function planSlotSurface(args: {
  voice?: VoiceRegister | null;
  recentEndingCounts?: Record<string, number> | null;
  lastEnding?: string | null;
  slotIndex?: number;
  seedKey?: string | null;
}): InferredSurface {
  const families: SurfaceEnding[] = ["HAEYO", "EUMSEUM", "OTHER"];
  const counts = args.recentEndingCounts || {};
  const used = (k: SurfaceEnding) => Number(counts[k] || 0);
  const last = String(args.lastEnding || "").toUpperCase();
  let candidates = families.slice();
  if (last && (families as string[]).includes(last) && candidates.length > 1) {
    candidates = candidates.filter((k) => k !== last);
  }
  const min = Math.min(...candidates.map(used));
  const least = candidates.filter((k) => used(k) === min);
  const ending = least[slotSalt(args.seedKey, args.slotIndex) % least.length];
  const reason =
    "historical Creator voice range only; Writer decides expression after understanding the assigned thought. No frozen seven-day surface mix.";
  return {
    ending,
    reason,
    constraint_line: [
      surfaceLine(ending),
      "REASON: " + reason,
      "Editorial mode is not 말투. USER_DIRECT rates are evidence, not a quota or a preselected surface. Writer decides after the thought.",
    ].join("\n"),
  };
}

/** @deprecated alias — planner decides; no mix quota */
export function inferSlotSurface(args: Parameters<typeof planSlotSurface>[0]): InferredSurface {
  return planSlotSurface(args);
}

export function voiceRegisterConstraintLine(
  reg: VoiceRegister | null | undefined,
  surface?: InferredSurface | null,
): string {
  const inferred = surface?.constraint_line ||
    "THIS POST SURFACE: pick 해요 or 음슴 after the thought is closed. Do not lock 말투 before the thought. No frozen mix ratio. Editorial mode is not a 말투 table.";
  if (!reg || reg.n <= 0) {
    return [
      "USER_DIRECT REGISTER: none in window — planner still decides this slot from Creator DNA two-speed + engine (no single global tone). No archive endings. No example posts. No frozen mix percentage.",
      inferred,
      "Do not copy handmade wording. A question is not a mechanism and not a participation trick. Engagement-bait closers (어떻게 생각하세요 / 궁금한가요) are forbidden. A genuine thinking question inside the closed thought is allowed.",
      "median_chars is a handmade statistic, not this post's target. Length follows the closed thought until it is complete. Not a character quota. Not one sentence because the slot is informational.",
    ].join("\n");
  }
  return [
    `USER_DIRECT REGISTER (stats only, no sample posts, not a mix quota): n=${reg.n} window=${reg.window_days}d median_chars=${reg.median_chars}`,
    `haeyo=${reg.ending_haeyo_rate} eumseum=${reg.ending_eumseum_rate} question=${reg.ending_question_rate} kk=${reg.kk_rate}`,
    `question_ending_allowed=${reg.question_ending_allowed} comparable_n=${reg.comparable_n} entry=${reg.comparable_entry_n}`,
    ...reg.notes,
    inferred,
    "Do not copy handmade wording. A question is not a mechanism and not a participation trick. Engagement-bait closers (어떻게 생각하세요 / 궁금한가요) are forbidden. A genuine thinking question inside the closed thought is allowed.",
    "median_chars is a handmade statistic, not this post's target. Length follows the closed thought until it is complete. Not a character quota. Not one sentence because the slot is informational.",
  ].join("\n");
}
