#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass += 1;
    console.log("  PASS ", name);
  } else {
    fail += 1;
    console.log("  FAIL ", name);
  }
}

const own = read("supabase/functions/weekly-plan/seed-ownership.ts");
const job = read("supabase/functions/weekly-plan/generation-job.ts");
const cr = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const wr = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const judge = read("supabase/functions/weekly-plan/semantic-judge.ts");
const planner = read("supabase/functions/weekly-plan/seven-day-planner.ts");
const lived = read("supabase/functions/weekly-plan/analytics-lived-seeds.ts");
const pub = read("supabase/functions/weekly-plan/public-x-seed-search.ts");

console.log("Public X / lived Analytics seed split (v12.5.0)");
ok("P1. public search is engagement collect not DNA interest list", !/FSD OR Tesla OR Grok/.test(pub + cr) && /PUBLIC_SEED_MIN_REPLIES/.test(cr) && /seedCollectorBounds/.test(cr) && !/Infer search interests from Creator DNA/.test(cr));
ok("P2. public X window is last 14 days", /last14/.test(own) && /st.public_search_half = "last14"/.test(job) && /meetsPublicSeedEngagement/.test(pub));
ok("P3. official recent search excludes operator handle", /search\/recent/.test(pub) && /excluded_x_handles/.test(cr) && /Seung4680/.test(pub));
ok("P4. public seeds owner OTHER + viral", /owner: "OTHER"/.test(cr) && /viral: true/.test(cr) && /owner: "OTHER"/.test(job));
ok("P5. lived seeds from Analytics plus sync-gap originals", /analyticsLivedSeeds/.test(lived) && /syncGapLivedSeeds/.test(lived) && /BUNDLED_X_ANALYTICS_WINDOW/.test(lived) && !/ARCHIVE_EXPERIENCE_FALLBACK/.test(job));
ok("P6. Planner does not extract analytics seeds", /applyNewestLivedExperienceAssignments/.test(job) && /EXPERIENCE slots take ANALYTICS_LIVED/.test(planner));
ok("P7. Writer OTHER inhabit ban + lived time buckets", /PUBLIC VIRAL/.test(wr) && /writerLivedTimeLines/.test(wr) && /3일 전/.test(own));
ok("P8. Judge N일 전 and other viral inhabit", /lived_time_day_count/.test(judge) && /other_viral_inhabited/.test(judge));
ok("P9. job starts expand before strategy", /step: "expand"/.test(job) && /Seed Generator 공개 X 탐색/.test(job));
ok("P10. x_search date window on seed generator", /from_date/.test(cr) && /api\.x\.ai\/v1\/responses/.test(cr));

const ownUrl = pathToFileURL(path.join(ROOT, "supabase/functions/weekly-plan/seed-ownership.ts")).href;
const { livedTimePhrase, applyNewestLivedExperienceAssignments, hasForbiddenDayCountPhrase } = await import(ownUrl);

const now = new Date("2026-08-16T20:00:00.000Z");
ok("P11. yesterday → 어제", livedTimePhrase("2026-08-15T20:00:00.000Z", now) === "어제");
ok("P12. 3 days → 저번주 not N일 전", livedTimePhrase("2026-08-13T20:00:00.000Z", now) === "저번주");
ok("P13. 20 days → 예전", livedTimePhrase("2026-07-27T20:00:00.000Z", now) === "예전");
ok("P14. forbids 3일 전", hasForbiddenDayCountPhrase("3일 전에 식겁") === true);

const ranked = applyNewestLivedExperienceAssignments({
  slots: [
    { slot_id: "e1", editorial_mode: "EXPERIENCE", planner_intent: "lived" },
    { slot_id: "p1", editorial_mode: "OPINION", planner_intent: "public" },
  ],
  assignments: [
    { slot_id: "e1", seed_id: "pub-1", planner_intent: "wrong", editorial_mode: "EXPERIENCE" },
    { slot_id: "p1", seed_id: "pub-2", planner_intent: "ok", editorial_mode: "OPINION" },
  ],
  missing: [],
  pool: [
    { seed_id: "old", owner: "SELF", occurred_at: "2026-07-20T00:00:00.000Z" },
    { seed_id: "new", owner: "SELF", occurred_at: "2026-08-15T00:00:00.000Z" },
    { seed_id: "pub-1", owner: "OTHER", viral: true },
  ],
});
ok("P15. OTHER cannot sit on EXPERIENCE; newest lived wins",
  ranked.assignments.find((a) => a.slot_id === "e1")?.seed_id === "new");
ok("P16. public OPINION assignment kept",
  ranked.assignments.find((a) => a.slot_id === "p1")?.seed_id === "pub-2");

console.log("========================================");
console.log(`PUBLIC-X SPLIT: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
