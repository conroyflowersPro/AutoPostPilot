#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const cr = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const pub = read("supabase/functions/weekly-plan/public-x-seed-search.ts");
const dna = read("supabase/functions/weekly-plan/engine-dna.ts");
const job = read("supabase/functions/weekly-plan/generation-job.ts");
const scope = read("supabase/functions/weekly-plan/seed-scope.ts");
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

function meetsPublicSeedEngagement(likes, replies) {
  return Number(likes || 0) >= 80 || Number(replies || 0) >= 20;
}

console.log("Seed collector (v12.4.3)");
ok("S1. likes 80 or replies 20, impressions ignored",
  /PUBLIC_SEED_MIN_LIKES = 80/.test(pub) && /PUBLIC_SEED_MIN_REPLIES = 20/.test(pub) &&
  /Impressions are not a gate/.test(dna) && meetsPublicSeedEngagement(80, 0) &&
  meetsPublicSeedEngagement(0, 20) && !meetsPublicSeedEngagement(79, 19));
ok("S2. Generator does not receive Creator DNA block or slot roles",
  /seedCollectorBounds\(\)/.test(cr) && !/creatorDnaBlock\(\)/.test(cr) &&
  !/planner_slot_intents/.test(cr) && !/open_slots/.test(cr.split("export async")[1] || ""));
ok("S3. no Return/Bridge/Reach labeling in collector prompt",
  /Do not judge RETURN\/BRIDGE\/REACH/.test(cr) && /No Return\/Bridge\/Reach labels/.test(cr));
ok("S4. Tesla only if already in the found post",
  /Keep Tesla\/FSD words only when they are already in the found post/.test(dna) &&
  /No Tesla\/FSD unless in the found post/.test(cr) &&
  /if \(\/테슬라\|tesla\/.test\(t\)\) return "TESLA"/.test(scope));
ok("S5. extract situation + observation + source id",
  /situation, observation_or_feeling, source_hint, source_id/.test(cr) &&
  /x\?\.situation \|\| x\?\.concrete_subject/.test(cr));
ok("S6. official search filters engagement and ads",
  /like_count/.test(pub) && /isPublicSeedAdOrBait/.test(pub) && /meetsPublicSeedEngagement/.test(pub));
ok("S7. job public search is 7 days every expand",
  /st.public_search_half = "near7"/.test(job) && !/half === "far"/.test(job));
ok("S8. version 12.4.3",
  /"version": "12.4.3"/.test(pkg) && /APP_VERSION = "12.4.3"/.test(ver) && /APP_VERSION = "12.4.3"/.test(ix));

console.log("========================================");
console.log(`SEED COLLECTOR: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
