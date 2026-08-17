#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const job = read("supabase/functions/weekly-plan/generation-job.ts");
const seed = read("supabase/functions/weekly-plan/creator-seed-reasoning.ts");
const scope = read("supabase/functions/weekly-plan/seed-scope.ts");
const engine = read("supabase/functions/weekly-plan/seed-engine.ts");
const grounding = read("supabase/functions/weekly-plan/runtime-grounding.ts");
const leakage = read("supabase/functions/weekly-plan/manual-leakage-guard.ts");
const humor = read("supabase/functions/weekly-plan/humor-fill.ts");
const stage = read("supabase/functions/weekly-plan/engine-stage-philosophy.ts");
const writer = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const writePipe = read("supabase/functions/weekly-plan/order-write-pipeline.ts");
const interpretation = read("supabase/functions/weekly-plan/seed-interpretation.ts");
const quota = read("supabase/functions/weekly-plan/quota-inference.ts");

let pass = 0;
let fail = 0;
function ok(name, condition) {
  if (condition) {
    pass += 1;
    console.log("  PASS ", name);
  } else {
    fail += 1;
    console.log("  FAIL ", name);
  }
}

console.log("Seed philosophy runtime (v12.5.2)");
ok("P1. candidate reserve is Planner slots plus week buffer", /candidatePoolTarget/.test(job) && /SEED_POOL_BUFFER/.test(job) && !/CANDIDATE_POOL_MULTIPLIER/.test(job));
ok("P2. server calls stay at max 10 seeds per tick", /const EXPAND_BATCH = 10/.test(job) && /Math\.min\(EXPAND_BATCH/.test(job));
ok("P3. discovery slots are not final personal-mass quotas", /OPEN_DISCOVERY/.test(scope) && /CREATOR_DNA_OR_ADJACENT/.test(scope));
ok("P4. short usable keywords survive normalize", /isUsableKeywordSubject\(situation\)/.test(seed) && !/subject\.length < 8/.test(seed));
ok("P5. candidate generation has no maxMass hard drop", !/const maxMass/.test(seed) && !/massN >= maxMass/.test(seed));
ok("P6. Seed Generator does not hard-reject strategic ticker/news value", !/isForbiddenDefaultSubject/.test(seed));
ok("P7. cross-interest is hypothesis-only, not reject", /CROSS_INTEREST_HYPOTHESIS_ONLY/.test(grounding) && !/CROSS_INTEREST_WITHOUT_RELATIONSHIP/.test(grounding));
ok("P8. jargon is not a Seed deletion gate", !/hasExpertJargon/.test(job) && !/hasExpertJargon/.test(seed));
ok("P9. duplicate comparison is USER_DIRECT originals only", /USER_DIRECT\|MANUAL/.test(job) && /REPLY\|REPOST\|RETWEET/.test(job));
ok("P10. manual semantic HIGH requires clone overlap, not shared context", /bestClone >= 0\.72/.test(leakage) && /bestContext >= 0\.45/.test(leakage));
ok("P11. Seed strategic ranking is removed", !/seedSelectionValueScore/.test(engine + job) && /Do not rank candidates/.test(seed));
ok("P12. Seed Grok receives candidate-only philosophy", /seedCandidatePhilosophyBlock/.test(seed) && /EXPLORE MANY/.test(stage));
ok("P13. recovery uses existing Pool before targeted exploration", /attachSeedsForSlots/.test(job) && /recoverSeedPool/.test(job));
ok("P14. seed rejection telemetry persists by reason", /seed_metrics/.test(job) && /rejected_by_reason/.test(job) && /raw_returned/.test(seed));
ok("P15. expansion and Planner recovery are bounded", /return Number\(st\.dim_batch/.test(job) && /pending\.attempts > 4/.test(job));
ok("P16. live seed, planner, and writer external endpoints are xAI only",
  /api\.x\.ai/.test(read("supabase/functions/weekly-plan/seven-day-planner.ts")) && /api\.x\.ai/.test(seed) && /api\.x\.ai/.test(writer) &&
  !/api\.openai\.com/.test(read("supabase/functions/weekly-plan/seven-day-planner.ts") + seed + writer));
ok("P17. current facts and locations survive as verify boundaries",
  /CURRENT_FACT_VERIFY_REQUIRED/.test(grounding) && /LOCATION_VERIFY_REQUIRED/.test(grounding) &&
  !/UNSUPPORTED_CURRENT_FACT/.test(grounding) && /verification_requirements/.test(writePipe) &&
  /verification_requirements/.test(interpretation));
ok("P18. Seed does not score AI-generic strategic value",
  !/genericPenalty/.test(engine) && !/reasons\.push\("AI_GENERIC"\)/.test(engine));
ok("P19. zero-add rounds expose raw and rejection diagnostics",
  /Seed round: 요청/.test(job) && /raw \$\{xaiRes\.raw_returned/.test(job) && /탈락 \$\{reasonText/.test(job));
ok("P20. frozen Seed guard rejects exact title, not substring vocabulary",
  /t === compactSubject\(s\)/.test(humor) && !/t\.includes\(compactSubject\(s\)\)/.test(humor));

console.log("========================================");
console.log(`SEED PHILOSOPHY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
