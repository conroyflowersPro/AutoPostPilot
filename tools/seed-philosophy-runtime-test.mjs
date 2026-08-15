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

console.log("Seed philosophy runtime (v11.10.1)");
ok("P1. candidate pool is at least 2x quota", /CANDIDATE_POOL_MULTIPLIER = 2/.test(job) && /candidatePoolTarget/.test(job));
ok("P2. server calls stay at max 10 seeds per tick", /const EXPAND_BATCH = 10/.test(job) && /Math\.min\(EXPAND_BATCH/.test(job));
ok("P3. discovery slots are not final personal-mass quotas", /OPEN_DISCOVERY/.test(scope) && /CREATOR_DNA_OR_ADJACENT/.test(scope));
ok("P4. short usable keywords survive normalize", /isUsableKeywordSubject\(subject\)/.test(seed) && !/subject\.length < 8/.test(seed));
ok("P5. candidate generation has no maxMass hard drop", !/const maxMass/.test(seed) && !/massN >= maxMass/.test(seed));
ok("P6. Elon mention alone is not forbidden", !/ELON_TESLA_DEFAULT_RE/.test(scope) && /GENERIC_TICKER_NEWS_RE/.test(scope));
ok("P7. cross-interest is hypothesis-only, not reject", /CROSS_INTEREST_HYPOTHESIS_ONLY/.test(grounding) && !/CROSS_INTEREST_WITHOUT_RELATIONSHIP/.test(grounding));
ok("P8. jargon remains a post gate, not a Seed deletion gate", !/hasExpertJargon/.test(job) && /hasExpertJargon\(text\)/.test(writer));
ok("P9. duplicate comparison is USER_DIRECT originals only", /USER_DIRECT\|MANUAL/.test(job) && /REPLY\|REPOST\|RETWEET/.test(job));
ok("P10. manual semantic HIGH requires strong overlap", /best >= 0\.72/.test(leakage));
ok("P11. structured xAI judgments rank selection", /seedSelectionValueScore/.test(engine) && /value \* 0\.55 \+ div \* 0\.45/.test(job));
ok("P12. Seed Grok receives candidate-only philosophy", /seedCandidatePhilosophyBlock/.test(seed) && /EXPLORE MANY/.test(stage));
ok("P13. reserve Seeds are used before another API search", /addedFromReserve/.test(job) && /새 API 탐색 없음/.test(job));
ok("P14. seed rejection telemetry persists by reason", /seed_metrics/.test(job) && /rejected_by_reason/.test(job) && /raw_returned/.test(seed));
ok("P15. expansion and write replacement are bounded", /return Number\(st\.dim_batch/.test(job) && /WRITE_FILL_MAX/.test(job));
ok("P16. live quota, seed, and writer external endpoints are xAI only",
  /api\.x\.ai/.test(quota) && /api\.x\.ai/.test(seed) && /api\.x\.ai/.test(writer) &&
  !/api\.openai\.com/.test(quota + seed + writer));
ok("P17. current facts and locations survive as verify boundaries",
  /CURRENT_FACT_VERIFY_REQUIRED/.test(grounding) && /LOCATION_VERIFY_REQUIRED/.test(grounding) &&
  !/UNSUPPORTED_CURRENT_FACT/.test(grounding) && /verification_requirements/.test(writePipe) &&
  /verification_requirements/.test(interpretation));
ok("P18. AI generic risk lowers selection rank instead of holding Seed",
  /genericPenalty/.test(engine) && !/reasons\.push\("AI_GENERIC"\)/.test(engine));
ok("P19. zero-add rounds expose raw and rejection diagnostics",
  /Seed round: 요청/.test(job) && /raw \$\{xaiRes\.raw_returned/.test(job) && /탈락 \$\{reasonText/.test(job));
ok("P20. frozen Seed guard rejects exact title, not substring vocabulary",
  /t === compactSubject\(s\)/.test(humor) && !/t\.includes\(compactSubject\(s\)\)/.test(humor));

console.log("========================================");
console.log(`SEED PHILOSOPHY: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
