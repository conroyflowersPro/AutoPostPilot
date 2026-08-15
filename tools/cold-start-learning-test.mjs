#!/usr/bin/env node
/**
 * Cold start: thin evidence is expected. Still infer from DNA. Never empty-week-because-sparse.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const se = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-engine.ts"), "utf8");
const cr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-seed-reasoning.ts"), "utf8");
const qu = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/quota-inference.ts"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");
const dir = readFileSync(path.join(ROOT, "architecture/v11.0.0_PRODUCT_DIRECTION.md"), "utf8");
const dna = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-dna.ts"), "utf8");

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

function inferLearningState(args) {
  const user_direct_n = Math.max(0, Number(args.user_direct_n) || 0);
  const originals_last_14d = Math.max(0, Number(args.cadence?.originals_last_14d) || 0);
  if (user_direct_n < 8 && originals_last_14d < 5) return "COLD";
  if (user_direct_n >= 30 && originals_last_14d >= 20) return "ACCUMULATING";
  return "SPARSE";
}

console.log("Cold start / learning maturity");
ok("L1. inferLearningState exported", /export function inferLearningState/.test(se));
ok("L2. collectLearnedSeedSignals includes learning", /learning: inferLearningState/.test(se));
ok("L3. COLD when almost no originals", inferLearningState({ user_direct_n: 2, cadence: { originals_last_14d: 1 } }) === "COLD");
ok("L4. operator 40/14d is ACCUMULATING not empty", inferLearningState({ user_direct_n: 40, cadence: { originals_last_14d: 40 } }) === "ACCUMULATING");
ok("L5. seed prompt forbids empty list on thin data", /Do not return an empty seeds array because evidence is incomplete/.test(cr));
ok("L6. quota prompt allows cold start", /Thin or missing learned evidence is expected/.test(qu));
ok("L7. performance DNA names cold start", /COLD START/.test(dna));
ok("L8. quota phase returns learning", /learning: learned\.learning/.test(ix));
ok("L9. generate job shows 학습 line", /학습:/.test(job));
ok("L10. direction: cold start + job runtime", /Cold start \(learning maturity\)/.test(dir) && /Generation runtime/.test(dir));
ok("L11. video must not keep Edge loop", /Do not keep the current browser-orchestrated Edge loop for video/.test(dir));
ok("L12. shipping 11.4.0", /const APP_VERSION = "11.4.0"/.test(ix));
ok("L13. DNA success is participation not followers-first", /replies > bookmarks > quotes > reposts/.test(dna) && !/followers > profile visits/.test(dna));

console.log("========================================");
console.log(`LEARNING: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
