#!/usr/bin/env node
/**
 * v11.1.2 — quota 28 then hang during seed expand, 0 drafts.
 * Cause: one Edge invoke called Grok twice (28s+28s) past the ~60s wall.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");
const gen = readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8");
const ow = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8");
const gi = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-integration.ts"), "utf8");
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

console.log("Expand hang after inferred quota (v11.1.2)");
ok("H1. EXPAND_BATCH is 10 (was 18)", /const EXPAND_BATCH = 10/.test(ix));
ok("H2. expand Grok timeout 18s (was 28s)", /timeoutMs:\s*18000/.test(ix));
ok("H3. no same-request expand retry", (ix.match(/await runExpand\(\)/g) || []).length === 1);
ok("H4. client aborts expand/quota ~45s", /phase === "expand" \|\| phase === "quota" \? 45000/.test(gen));
ok("H5. client aborts write ~50s", /phase === "write" \? 50000/.test(gen));
ok("H6. AbortError shows Korean timeout, does not hang", /AbortError/.test(gen) && /초 안에 끝나지 않았습니다/.test(gen));
ok("H7. write chunk failure does not abort the week", /writeErrors\.push/.test(gen) && /continue;/.test(gen));
ok("H8. empty drafts are not saved", /if \(!text\)/.test(gen) && /빈 초안/.test(gen));
ok("H9. WRITE_CHUNK is 2", /const WRITE_CHUNK = 2/.test(gen));
ok("H10. write concurrency 2 / timeout 16s", /V11_WRITE_CONCURRENCY = 2/.test(ow) && /V11_WRITER_TIMEOUT_MS = 16000/.test(ow));
ok("H11. write skips same-seed Grok retry", /allow_one_retry:\s*false/.test(ow));
ok("H12. 7C honors allow_one_retry false", /options\.allow_one_retry !== false/.test(gi));
ok("H13. seed-reasoning default timeout 18s", /timeoutMs \?\? 18000/.test(cr));
ok("H14. shipping version 11.1.2", /const APP_VERSION = "11.1.2"/.test(ix));

console.log("========================================");
console.log(`HANG FIX: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
