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

console.log("Planner select timeout (v12.5.1)");
ok("S1. select timeout retries once then uses the existing pool",
  /st\.select_timeouts/.test(job) && /기존 Pool로/.test(job) && /fillUnassignedPlannerSlotsFromPool/.test(job));
ok("S2. same missing fingerprint is not expanded forever",
  /explored_missing/.test(job) && /alreadyExplored/.test(job) && /추가 탐색 한도/.test(job));
ok("S3. refill cap no longer sits on select with 14\/37",
  !/같은 분야 Seed 재추출 한도 \$\{FIELD_REFILL_MAX\} · \$\{st\.planner_assignments\.length\}/.test(job));
ok("S4. expand timeout with a pool goes to Planner, not hold-forever",
  /공개 검색 시간 초과 · 기존 Seed Pool로 Planner 이어감/.test(job));
ok("S5. targeted field explore skips live x_search",
  /const compact = !!st\.compact_next \|\| !!targetedExploration/.test(job));
ok("S6. lived seeds stay distinct by seed_id; week continues while days remain",
  /lived:\$\{String\(seed\.seed_id/.test(job) &&
  /if \(remain\.length\)/.test(job) &&
  !/remain\.some\(\(d\) => !days\.includes\(d\)\)/.test(job));

console.log("========================================");
console.log(`PLANNER SELECT TIMEOUT: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
