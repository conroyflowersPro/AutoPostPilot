#!/usr/bin/env node
/**
 * v11.1.4 — 0/28 after cadence fallback.
 * grok-4.6 defaults to reasoning_effort high; 18s abort → zero JSON seeds.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-seed-reasoning.ts"), "utf8");
const qu = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/quota-inference.ts"), "utf8");
const wr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/independent-post-generation.ts"), "utf8");
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");

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

console.log("Grok 4.6 reasoning_effort low (v11.1.4 0/28)");
ok("R1. seed expand uses reasoning_effort low", /reasoning_effort:\s*"low"/.test(cr));
ok("R2. quota uses reasoning_effort low", /reasoning_effort:\s*"low"/.test(qu));
ok("R3. writer is Grok 4.6 with reasoning_effort low", /api\.x\.ai\/v1\/chat\/completions/.test(wr) && /reasoning_effort:\s*"low"/.test(wr) && /callGrokWriter/.test(wr));
ok("R4. expand abort labeled xai_timeout", /xai_timeout/.test(cr));
ok("R5. quota fallback keeps grok_error", /grok_error/.test(qu) && /quota_grok_error/.test(ix));
ok("R6. expand cause is kept on the job", /last_expand_error/.test(job) && /원인:/.test(job));
ok("R7. still no template fill", /템플릿으로 채우지 않습니다/.test(job));
ok("R9. expand max_tokens room for JSON", /max_tokens: compact \? 4096 : 8192/.test(cr));
ok("R10. seed list accepts alternate JSON keys", /seedListFromParsed/.test(cr));

console.log("========================================");
console.log(`REASONING LOW: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
