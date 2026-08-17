#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const cr = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const pub = read("supabase/functions/weekly-plan/public-x-seed-search.ts");
const dna = read("supabase/functions/weekly-plan/engine-dna.ts");
const job = read("supabase/functions/weekly-plan/generation-job.ts");
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

function meetsPrimary(replies) {
  return Number(replies || 0) >= 20;
}

console.log("Seed collector (v12.5.2)");
ok("S1. replies 20 primary; impressions 50k only as supplement",
  /PUBLIC_SEED_MIN_REPLIES = 20/.test(pub) && /PUBLIC_SEED_SUPPLEMENT_IMPRESSIONS = 50_000/.test(pub) &&
  /Do not use likes, reposts, or bookmarks/.test(dna) && meetsPrimary(20) && !meetsPrimary(19));
ok("S2. Generator does not receive Creator DNA block or slot roles",
  /seedCollectorBounds\(\)/.test(cr) && !/creatorDnaBlock\(\)/.test(cr) &&
  !/planner_slot_intents/.test(cr) && !/open_slots/.test(cr.split("export async")[1] || ""));
ok("S3. no Return/Bridge/Reach labeling in collector prompt",
  /Do not judge RETURN\/BRIDGE\/REACH/.test(cr) && /No Return\/Bridge\/Reach labels/.test(cr));
ok("S4. Tesla only if already in the found post",
  /Keep Tesla\/FSD words only when they are already in the found post/.test(dna) &&
  /No Tesla\/FSD unless in the found post/.test(cr));
ok("S5. extract situation + observation + source id",
  /situation, observation_or_feeling, source_hint, source_id/.test(cr) &&
  /x\?\.situation \|\| x\?\.concrete_subject/.test(cr));
ok("S6. official search filters replies, ads, short, RT",
  /reply_count/.test(pub) && /isPublicSeedAdOrBait/.test(pub) && /filterOfficialPublicPosts/.test(pub) &&
  /isContextlessShort/.test(pub) && /isRetweetHeavy/.test(pub));
ok("S7. job public search is 14 days",
  /st.public_search_half = "last14"/.test(job) && /PUBLIC_SEED_WINDOW_DAYS = 14/.test(dna));
ok("S8. version 12.5.2",
  /"version": "12.5.2"/.test(pkg) && /APP_VERSION = "12.5.2"/.test(ver) && /APP_VERSION = "12.5.2"/.test(ix));

console.log("========================================");
console.log(`SEED COLLECTOR: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
