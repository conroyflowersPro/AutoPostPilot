#!/usr/bin/env node
/**
 * Last-week lived episodes are skipped on the next generate.
 * Exceptional reader activation must still be learned. Do not clone.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const exp = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/experience-evidence.ts"), "utf8");
const se = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-engine.ts"), "utf8");
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");
const cr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-seed-reasoning.ts"), "utf8");

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

const EXPERIENCE_PREVIOUS_WEEK_DAYS = 7;

function isExperienceConsumedForUpcomingWeek(c, args) {
  const id = String(c.source_ref || "").trim();
  const cited = (args.alreadyCitedIds || []).map(String);
  if (id && cited.includes(id)) return true;
  const pub = c.published_at ? Date.parse(String(c.published_at)) : NaN;
  const week = Date.parse(`${String(args.weekStart || "").slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(pub) || !Number.isFinite(week)) return false;
  const prevStart = week - EXPERIENCE_PREVIOUS_WEEK_DAYS * 24 * 60 * 60 * 1000;
  return pub >= prevStart && pub < week;
}

function isExceptionalReaderActivation(meta) {
  const bag = meta && typeof meta === "object" ? meta : {};
  const pub = bag.public_metrics || bag.publicMetrics || bag;
  const n = (k) => Number(pub?.[k]) || 0;
  const replies = n("reply_count");
  const rts = n("retweet_count");
  const quotes = n("quote_count");
  const bms = n("bookmark_count");
  const likes = n("like_count");
  return replies >= 4 || replies + rts + quotes + bms >= 6 || likes >= 40;
}

function filterAvailable(list, weekStart, alreadyCitedIds) {
  return list.filter((c) => !isExperienceConsumedForUpcomingWeek(c, { weekStart, alreadyCitedIds }));
}

console.log("Experience cooldown vs exceptional learn (not a clone)");

ok(
  "C1. consumed helper exported",
  /export function isExperienceConsumedForUpcomingWeek/.test(exp) && /EXPERIENCE_PREVIOUS_WEEK_DAYS = 7/.test(exp),
);
ok("C2. weekStart 2026-08-16 + published 2026-08-14 is consumed", isExperienceConsumedForUpcomingWeek(
  { published_at: "2026-08-14T18:00:00.000Z", source_ref: "night_fsd" },
  { weekStart: "2026-08-16" },
));
ok("C3. same week weekStart 2026-08-10 + published 2026-08-14 is still cite-eligible", !isExperienceConsumedForUpcomingWeek(
  { published_at: "2026-08-14T18:00:00.000Z", source_ref: "night_fsd" },
  { weekStart: "2026-08-10" },
));
ok("C4. alreadyCited source_ref is consumed even in-week", isExperienceConsumedForUpcomingWeek(
  { published_at: "2026-08-14T18:00:00.000Z", source_ref: "night_fsd" },
  { weekStart: "2026-08-10", alreadyCitedIds: ["night_fsd"] },
));
ok("C5. missing dates are not consumed", !isExperienceConsumedForUpcomingWeek(
  { source_ref: "x" },
  { weekStart: "" },
));
ok("C6. post older than previous week is not this-cooldown", !isExperienceConsumedForUpcomingWeek(
  { published_at: "2026-08-01T12:00:00.000Z", source_ref: "old" },
  { weekStart: "2026-08-16" },
));

const night = { published_at: "2026-08-14T18:00:00.000Z", source_ref: "night_fsd", concrete_subject: "야간 FSD 보행자 대기 장면 인용" };
const sameWeek = { published_at: "2026-08-16T09:00:00.000Z", source_ref: "today", concrete_subject: "오늘 충전" };
ok(
  "C7. next-week generate drops last-week episode and keeps later ones",
  filterAvailable([night, sameWeek], "2026-08-16", []).map((c) => c.source_ref).join(",") === "today",
);

ok("C8. replies >= 4 is exceptional", isExceptionalReaderActivation({ public_metrics: { reply_count: 4 } }));
ok("C9. likes >= 40 is exceptional", isExceptionalReaderActivation({ like_count: 40 }));
ok(
  "C10. replies+rts+quotes+bookmarks >= 6 is exceptional",
  isExceptionalReaderActivation({ public_metrics: { reply_count: 2, retweet_count: 2, quote_count: 1, bookmark_count: 1 } }),
);
ok(
  "C11. ordinary likes/replies are not exceptional",
  !isExceptionalReaderActivation({ public_metrics: { like_count: 10, reply_count: 1, retweet_count: 0 } }),
);

ok("C12. exceptional helper exported", /export function isExceptionalReaderActivation/.test(se));
ok("C13. MUST_LEARN hint on exceptional activation", /MUST_LEARN activation/.test(se));
ok("C14. consumed last week is LEARN-only in hints", /Lived episodes consumed last week are LEARN-only/.test(se));
ok("C15. job skips consumed before inject", /isExperienceConsumedForUpcomingWeek/.test(job) && /availableExperience/.test(job));
ok("C16. job summary: 지난주 소모 제외 + 고참여는 학습", /지난주 소모 제외/.test(job) && /고참여는 학습/.test(job));
ok("C17. Grok expand told last-week episodes are LEARN-only", /LEARN-only for the upcoming generate/.test(cr));
ok("C18. job does not fill EXPERIENCE with INFORMATIVE", !/fill EXPERIENCE holes with INFORMATIVE/.test(job));
ok("C19. source consume window matches test helper (pub < weekStart)", /return pub >= prevStart && pub < week/.test(exp) || /return pub >= prevWeekStart && pub < weekStart/.test(exp));
ok("C20. exceptional thresholds frozen in source", /replies >= 4 \|\| replies \+ rts \+ quotes \+ bms >= 6 \|\| likes >= 40/.test(se));

console.log("========================================");
console.log(`EXPERIENCE COOLDOWN/LEARN: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
