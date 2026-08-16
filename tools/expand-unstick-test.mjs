#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");

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

console.log("Expand unstick (v12.1.4)");
ok("U1. pre-strategy pool target is one public batch, not week-size 38",
  /if \(required <= 0\) return EXPAND_BATCH/.test(job) &&
  !/const base = required > 0 \? required : MIN_WEEKLY_SLOTS/.test(job));
ok("U2. expand can finish when required_slots is still 0",
  /function expandPoolFilled/.test(job) &&
  !/required > 0 && candidateCount >= poolTarget/.test(job));
ok("U3. pre-strategy fill counts public viral, not Analytics lived",
  /function publicViralSeedCount/.test(job) &&
  /if \(required <= 0\) return publicViralSeedCount\(gated\) >= EXPAND_BATCH/.test(job));
ok("U4. skip another public X round once the pre-strategy batch is in",
  /function shouldSkipPublicXSearch/.test(job) &&
  /shouldSkipPublicXSearch\(required, st\.gated/.test(job));
ok("U5. lived inventory plus empty public round goes to Planner, not compact loop",
  /required <= 0 && livedReady && !targetedExploration/.test(job) &&
  /탐색 완료 · 슬롯 수 정하는 중/.test(job));
ok("U6. Planner refill still uses slots plus buffer",
  /return required \+ CANDIDATE_RESERVE_MIN/.test(job) && /SEED_POOL_BUFFER/.test(job));

console.log("========================================");
console.log(`EXPAND UNSTICK: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
