#!/usr/bin/env node
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");

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

function situationCluster(text) {
  const t = String(text || "").toLowerCase();
  if (/fsd|완전자율|오토파일럿|autosteer|autopilot/.test(t)) return "FSD";
  if (/교차로|신호등|횡단보도/.test(t)) return "INTERSECTION";
  if (/주차|후진|주차장/.test(t)) return "PARKING";
  if (/출퇴근|운전|핸들|차선|주행/.test(t)) return "DRIVING";
  return "OTHER";
}

console.log("Scene diversity (v12.5.0)");
const src = read("supabase/functions/weekly-plan/situation-diversity.ts");
ok("C1. FSD vs parking vs other lockstep",
  situationCluster("FSD가 교차로에서") === "FSD" &&
  situationCluster("주차장 후진") === "PARKING" &&
  situationCluster("카페 줄") === "OTHER" &&
  /export function situationCluster/.test(src));
ok("C2. consecutive cluster + day cap in parser",
  /FSD_DRIVING_PER_DAY_MAX = 2/.test(src) && /canPlaceAfterPrevious/.test(src) &&
  /BETTER_THAN_BEFORE/.test(src) && /STILL_AMBIGUOUS/.test(src));
ok("C3. overweight defer + assignment swap",
  /deferOverweightDrivingFamily/.test(src) && /diversifyAssignments/.test(src) &&
  /DRIVING_FAMILY_SHARE_MAX = 0.35/.test(src));
ok("C4. bolt-on charging/Uber",
  /hasUnseededDrivingBoltOn/.test(src) && /충전\|우버/.test(src));

const dna = read("supabase/functions/weekly-plan/engine-dna.ts");
const pub = read("supabase/functions/weekly-plan/public-x-seed-search.ts");
const cr = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const job = read("supabase/functions/weekly-plan/generation-job.ts");
const own = read("supabase/functions/weekly-plan/seed-ownership.ts");
const slots = read("supabase/functions/weekly-plan/creator-week-slots.ts");
const planner = read("supabase/functions/weekly-plan/seven-day-planner.ts");
ok("C5. collector replies 20 / 14d / impression supplement",
  /PUBLIC_SEED_MIN_REPLIES = 20/.test(pub) && /PUBLIC_SEED_WINDOW_DAYS = 14/.test(dna) &&
  /PUBLIC_SEED_SUPPLEMENT_IMPRESSIONS = 50_000/.test(pub) &&
  /Do not use likes, reposts, or bookmarks/.test(dna));
ok("C6. Writer slice diversity + Tesla only if seed",
  /DIVERSITY: Avoid the previous post's scene/.test(dna) &&
  /Tesla\/FSD appears only if this seed is that situation/.test(dna));
ok("C7. job uses last14",
  /st.public_search_half = "last14"/.test(job) && /key: "last14"/.test(own));
ok("C8. no likes keep gate in collector",
  !/PUBLIC_SEED_MIN_LIKES/.test(cr) && !/likes_or_more/.test(cr));
ok("C9. Creator slots + Planner attach diversity",
  /consecutive slots must not share the same situation cluster/.test(slots) &&
  /Do not freeze RETURN\/BRIDGE share/.test(slots) &&
  /diversifyAssignments/.test(planner));
ok("C10. version 12.5.0", /APP_VERSION = "12.5.0"/.test(read("lib/version.ts")));

console.log("========================================");
console.log(`SCENE DIVERSITY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
