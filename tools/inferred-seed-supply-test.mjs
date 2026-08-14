#!/usr/bin/env node
/**
 * Inferred seed supply — not a repeating 8-axis bot.
 * Source-contract tests (Edge runs TS; Node verifies the lock).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const se = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-engine.ts"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");
const cr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-seed-reasoning.ts"), "utf8");
const gen = readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8");
const dir = readFileSync(path.join(ROOT, "architecture/v11.0.0_PRODUCT_DIRECTION.md"), "utf8");

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

console.log("Inferred seed supply (learned data, not fixed registry bodies)");
ok("S1. collectLearnedSeedSignals exported", /export function collectLearnedSeedSignals/.test(se));
ok("S2. bootstrap does not construct registry abstract subjects", !/\$\{dim\.cluster\} \$\{dim\.dimension\}/.test(se) && !/DIMENSION_ABSTRACT/.test(se));
ok("S3. bootstrap comment: registry not seed body", /never a production seed body/.test(se));
ok("S4. bootstrap still learning-pass only", /Learning pass only/.test(se) && /Never auto SEED from manual body/.test(se));
ok("S5. expand fail-closed insufficient", /SEED_SUPPLY_INSUFFICIENT/.test(ix) && /SEED_INFERENCE_FAILED/.test(ix));
ok("S6. expand requires xAI, no template fallback", /SEED_INFERENCE_REQUIRES_XAI/.test(ix) && /fixed registry templates are not a valid fallback/.test(ix));
ok("S7. select fail-closed shortfall", /SEED_SELECT_SHORTFALL/.test(ix));
ok("S8. select does not lie seed_expansion true", !/xai_usage: \{ seed_expansion: true/.test(ix));
ok("S9. Grok rejects registry-label bodies", /관찰·판단 축/.test(cr) && /Do NOT copy DIMENSION labels/.test(cr));
ok("S10. mix follows cluster_weights", /cluster_weights_from_user_direct/.test(cr));
ok("S11. generate does not save short week", /REQUIRED_SLOTS/.test(gen) && /고정 템플릿으로 채우지 않습니다/.test(gen));
ok("S12. generate throws before insert if planned short", /주간 계획이/.test(gen) && /저장하지 않습니다/.test(gen));
ok("S13. direction: registry as hints only", /repeating bot/.test(dir) && /fails closed/.test(dir));
ok("S14. expand batched from learned data", /EXPAND_BATCH/.test(ix) && /collectLearnedSeedSignals/.test(ix));
ok("S15. engine version inferred seeds", /v11_inferred_seeds_not_registry/.test(ix));

console.log("========================================");
console.log(`INFERRED SEEDS: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
