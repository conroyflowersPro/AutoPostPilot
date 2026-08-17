#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const creator = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-week-slots.ts"), "utf8");
const ver = readFileSync(path.join(ROOT, "lib/version.ts"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");

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

function creatorDaysAreOneBased(rawOffsets, allowed) {
  const nums = rawOffsets.filter((n) => Number.isFinite(n));
  if (!nums.length || !allowed.length) return false;
  const zeroOk = nums.filter((n) => allowed.includes(n)).length;
  const oneOk = nums.filter((n) => allowed.includes(n - 1)).length;
  return oneOk > zeroOk;
}

console.log("Creator day-slot JSON (v12.5.0)");
ok("J1. 1,2 against requested 0,1 is 1-based",
  creatorDaysAreOneBased([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2], [0, 1]) === true);
ok("J2. 0,1 against requested 0,1 stays 0-based",
  creatorDaysAreOneBased([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], [0, 1]) === false);
ok("J3. parser uses oneOk > zeroOk", /oneOk > zeroOk/.test(creator));
ok("J4. slot fill sends counts not the full Audience dump",
  /audience_counts: compactAudienceCounts/.test(creator) &&
  !/audience_block: audienceStatusBlock/.test(creator) &&
  /required_slot_count_this_call/.test(creator));
ok("J5. empty slots stay unusable; partial fills pad",
  /if \(!slots.length\) return null/.test(creator) && /PAD_MODES/.test(creator));
ok("J6. prompt says day_offset is 0-based", /day_offset is 0-based/.test(creator));
ok("J7. version 12.5.0", /APP_VERSION = "12.5.0"/.test(ver) && /APP_VERSION = "12.5.0"/.test(ix));

console.log("========================================");
console.log(`CREATOR DAY JSON: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
