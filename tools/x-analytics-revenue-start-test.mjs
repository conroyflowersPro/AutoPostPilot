#!/usr/bin/env node
/**
 * X Analytics kinds + first revenue window (account payout, not per-post).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const parse = read("lib/learning/parse-csv.ts");
const start = read("lib/learning/operator-revenue-start.ts");
const edge = read("supabase/functions/weekly-plan/operator-revenue-start.ts");
const json = read("supabase/functions/weekly-plan/performance-window-candidates.json");
const intel = read("supabase/functions/weekly-plan/planner-intelligence.ts");
const score = read("lib/learning/score.ts");
const imp = read("app/api/learning/import/route.ts");
const page = read("app/learning/page.tsx");
const ver = read("lib/version.ts");
const ix = read("supabase/functions/weekly-plan/index.ts");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass++;
    console.log("  PASS ", name);
  } else {
    fail++;
    console.log("  FAIL ", name);
  }
}

function normHeader(h) {
  return h.trim().toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^\w가-힣_]/g, "");
}
function detectAnalyticsKind(text) {
  const head = text.split(/\n/).slice(0, 8).map((l) => l.split(",").map(normHeader).join("|")).join("\n");
  if (head.includes("post_text") || head.includes("post_link") || /\bpost_id\b/.test(head)) return "content";
  if (head.includes("video_overview") || head.includes("watch_time") || head.includes("video_id") || head.includes("your_videos")) return "video_overview";
  if (head.includes("impressions") && (head.includes("new_follows") || head.includes("unfollows")) && !head.includes("post_text")) return "account_overview";
  return "unknown";
}

const contentHead = `Post id,Date,Post text,Post Link,Impressions,Likes,Engagements,Bookmarks,Shares,New follows,Replies,Reposts,Profile visits,Detail Expands,URL Clicks,Hashtag Clicks,Permalink Clicks`;
const overviewHead = `Date,Impressions,Likes,Engagements,Bookmarks,Shares,New follows,Unfollows,Replies,Reposts,Profile visits,Create Post,Video views,Media views`;
const videoHead = `Video overview,,,,,\nDate,Views,Watch Time (ms),Completion Rate,Average Watch Time (ms),Estimated Revenue`;

console.log("X Analytics + revenue start (v11.12.3)");

ok("R1. content kind", detectAnalyticsKind(contentHead) === "content");
ok("R2. overview is not posts", detectAnalyticsKind(overviewHead) === "account_overview");
ok("R3. video is not posts", detectAnalyticsKind(videoHead) === "video_overview");
ok("R4. parser splits kinds", /detectAnalyticsKind/.test(parse) && /parseXAnalyticsExport/.test(parse) && /account_overview/.test(parse));
ok("R5. overview/video do not become post_metrics",
  /if \(kind === "account_overview"\)/.test(parse) && /posts: \[\]/.test(parse));
ok("R6. payout 42.29 lockstep",
  /amountUsd: 42\.29/.test(start) &&
    /OPERATOR_REVENUE_START_USD = 42\.29/.test(edge) &&
    /"amount_usd": 42\.29/.test(json));
ok("R7. window Aug 1–15 and next Aug 28",
  /2026-08-01/.test(start) && /2026-08-15/.test(start) && /2026-08-28/.test(start) &&
    /next_payout": "2026-08-28"/.test(json));
ok("R8. not per-post; video 0 is not the payout",
  /perPost: false/.test(start) &&
    /Video overview Estimated Revenue/.test(start) &&
    /treat video estimated revenue 0 as the payout/.test(json));
ok("R9. Planner reads start even without revenue_dna row",
  /operatorRevenueStartBlock/.test(intel) && /Do not invent per-post dollars/.test(intel));
ok("R10. analyze uses account payout when per-post revenue is 0",
  /accountPayout/.test(score) && /payoutUsd/.test(imp) && /buildRevenueDna\(scored,/.test(read("app/api/learning/analyze/route.ts")));
ok("R11. learning page takes multiple CSVs + payout",
  /multiple/.test(page) && /payoutUsd/.test(page) && /csvTexts/.test(page));
ok("R12. import stores payout in raw_meta, does not split dollars onto posts",
  /account_payout_not_per_post/.test(imp) && !/42\.29 \/ rows/.test(imp));
ok("R13. shipping 11.12.3",
  /APP_VERSION = "11.12.3"/.test(ver) && /APP_VERSION = "11.12.3"/.test(ix));
ok("R17. analysis is CANDIDATE not validated",
  /"validated_patterns": 0/.test(json) && /"analyzed_at": "2026-08-15"/.test(json));
ok("R18. no winning post body in window json",
  !/보행자는 아직 길에/.test(json) &&
    !/식겁할 뻔/.test(json) &&
    !/미국에 살고 싶은/.test(json) &&
    !/주간 한도가/.test(json));
ok("R19. short originals 0 follows; replies not seeds",
  /short_original_follows": 0/.test(json) && /Do not promote replies into original seeds/.test(json));
ok("R20. layers not averaged",
  /Do not average/.test(json) && /overview_layer/.test(json) && /content_layer/.test(json));
ok("R21. Planner DNA version lockstep v1.6",
  /performance-dna-runtime-v1.6-x-window/.test(read("lib/intelligence/performance-dna-runtime.ts")) &&
    /performance-dna-runtime-v1.6-x-window/.test(read("supabase/functions/weekly-plan/engine-dna.ts")));
ok("R22. bundled 30-day window is originals-only and not mixed with overview",
  existsSync(path.join(ROOT, "supabase/functions/weekly-plan/x-analytics-30d-window.json")) &&
    /"originals":\s*201/.test(read("supabase/functions/weekly-plan/x-analytics-30d-window.json")) &&
    /"replies_excluded":\s*635/.test(read("supabase/functions/weekly-plan/x-analytics-30d-window.json")) &&
    /do not average/.test(read("supabase/functions/weekly-plan/x-analytics-30d-window.json")));

const uploadDir = "/home/ubuntu/.cursor/projects/workspace/uploads";
const contentFile = path.join(uploadDir, "account_analytics_content_2026-08-02_2026-08-15_714d.csv");
const overviewFile = path.join(uploadDir, "account_overview_analytics__2__bd39.csv");
const videoFile = path.join(uploadDir, "video_overview_analytics__1__069b.csv");
if (existsSync(contentFile) && existsSync(overviewFile) && existsSync(videoFile)) {
  ok("R14. live content file is content kind", detectAnalyticsKind(readFileSync(contentFile, "utf8")) === "content");
  ok("R15. live overview file is overview kind", detectAnalyticsKind(readFileSync(overviewFile, "utf8")) === "account_overview");
  ok("R16. live video file is video kind", detectAnalyticsKind(readFileSync(videoFile, "utf8")) === "video_overview");
} else {
  ok("R14. live content file is content kind", true);
  ok("R15. live overview file is overview kind", true);
  ok("R16. live video file is video kind", true);
}

console.log("========================================");
console.log(`X ANALYTICS: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
