#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

const job = read("supabase/functions/weekly-plan/generation-job.ts");
const creator = read("supabase/functions/weekly-plan/creator-week-slots.ts");
const audience = read("supabase/functions/weekly-plan/audience-x-status.ts");
const planner = read("supabase/functions/weekly-plan/seven-day-planner.ts");
const lived = read("supabase/functions/weekly-plan/analytics-lived-seeds.ts");
const dna = read("supabase/functions/weekly-plan/engine-dna.ts");
const wr = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const ver = read("lib/version.ts");
const ix = read("supabase/functions/weekly-plan/index.ts");
const pkg = read("package.json");

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

console.log("Creator slot judgment (v12.4.3)");

ok("C1. Audience DNA reports status only",
  /Do not decide slots/.test(audience) && /lived_scene_count/.test(audience) && /sync_gap_originals/.test(audience));
ok("C2. Creator DNA judges RETURN/BRIDGE/REACH and types",
  /growthRole/.test(creator) && /inferCreatorWeekVolume/.test(creator) && /inferCreatorSlotsForDays/.test(creator) &&
  /PRESENCE is not a role/.test(creator));
ok("C3. Job uses Creator volume/slots, not Planner type inference",
  /inferCreatorWeekVolume/.test(job) && /inferCreatorSlotsForDays/.test(job) &&
  !/inferSevenDayVolume\(/.test(job) && !/inferSevenDaySlotsForDays\(/.test(job));
ok("C4. Planner attach does not change types",
  /Creator DNA already judged RETURN\/BRIDGE\/REACH/.test(planner) && /attachSeedsForSlots/.test(planner));
ok("C5. Reject batch goes to Creator DNA then Planner Seeds",
  /creatorRelabelRejectBatch/.test(job) && /attachSeedsForSlots/.test(job) && /RECOVER_WRITE_CHUNK = 4/.test(job));
ok("C6. Sync-gap lived seeds join Analytics lived seeds",
  /syncGapLivedSeeds/.test(lived) && /syncGapLivedSeeds/.test(job) && /동기화 공백/.test(job));
ok("C7. Writer receives Creator DNA writer slice",
  /creatorDnaWriterSlice\(/.test(wr) && /CREATOR INTELLIGENCE/.test(wr));
ok("C8. Pipeline text: Audience → Creator → Planner place",
  /Audience DNA reports X status/.test(dna) && /Reject batches return to Creator DNA/.test(dna));
ok("C9. version lockstep 12.4.3",
  /"version": "12.4.3"/.test(pkg) && /APP_VERSION = "12.4.3"/.test(ver) && /APP_VERSION = "12.4.3"/.test(ix));

console.log("========================================");
console.log(`CREATOR SLOT JUDGMENT: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
