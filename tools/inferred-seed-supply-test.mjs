#!/usr/bin/env node
/**
 * Inferred seed supply — quota inferred, then Grok fills it.
 * Not a repeating 8-axis bot. Not a frozen 42.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const se = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seed-engine.ts"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");
const cr = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/creator-seed-reasoning.ts"), "utf8");
const gen = readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8");
const dir = readFileSync(path.join(ROOT, "architecture/v11.0.0_PRODUCT_DIRECTION.md"), "utf8");
const qf = path.join(ROOT, "supabase/functions/weekly-plan/quota-inference.ts");
const qu = existsSync(qf) ? readFileSync(qf, "utf8") : "";

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

console.log("Inferred quota + fill (learned data, not fixed registry / not frozen 42)");
ok("S1. collectLearnedSeedSignals exported", /export function collectLearnedSeedSignals/.test(se));
ok("S2. bootstrap does not construct registry abstract subjects", !/\$\{dim\.cluster\} \$\{dim\.dimension\}/.test(se) && !/DIMENSION_ABSTRACT/.test(se));
ok("S3. bootstrap comment: registry not seed body", /never a production seed body/.test(se));
ok("S4. bootstrap still learning-pass only", /Learning pass only/.test(se) && /Never auto SEED from manual body/.test(se));
ok("S5. expand does not abort on shortfall", !/SEED_SUPPLY_INSUFFICIENT/.test(ix) && /expand_done = cumulative >= required_slots/.test(ix));
ok("S6. expand requires xAI, no template fallback", /SEED_INFERENCE_REQUIRES_XAI/.test(ix) && /fixed registry templates are not a valid fallback/.test(ix));
ok("S7. select asks for more seeds instead of aborting the week", /NEED_MORE_SEEDS/.test(ix) && !/SEED_SELECT_SHORTFALL/.test(ix));
ok("S8. select does not lie seed_expansion true", !/xai_usage: \{ seed_expansion: true/.test(ix));
ok("S9. Grok rejects registry-label bodies", /관찰·판단 축/.test(cr) && /Do NOT copy DIMENSION labels/.test(cr));
ok("S10. mix follows cluster_weights", /cluster_weights_from_user_direct/.test(cr));
ok("S11. generate infers quota first", /phase: "quota"/.test(gen) && /requiredSlots/.test(gen));
ok("S12. generate keeps expanding until quota filled", /allGated.length < requiredSlots/.test(gen) && /할당량 보충/.test(gen));
ok("S13. direction: quota inferred then filled", /weekly quota itself is inferred/.test(dir) && /must fill it/.test(dir));
ok("S14. expand batched from learned data", /EXPAND_BATCH/.test(ix) && /collectLearnedSeedSignals/.test(ix));
ok("S15. engine version quota fill", /v11_inferred_quota_fill/.test(ix));
ok("S16. quota-inference module", /export async function inferWeeklyQuota/.test(qu) && /quotaFromCadence/.test(qu));
ok("S17. cadence on learned signals", /cadence: CadenceSignal/.test(se) || /avg_originals_on_active_days/.test(se));
ok("S18. quota phase on edge", /phase === "quota"/.test(ix) && /inferWeeklyQuota/.test(ix));
ok("S19. fill inferred quota from DNA", /Fill the inferred quota/.test(cr) && /engine_rules_are_the_will/.test(cr));
ok("S20. will is DNA+engine not a slogan", /Will lives in the engine and DNA/.test(dir) && !/operator_will/.test(qu) && /engineRulesAsWill/.test(qu));
ok("S21. engine-dna module is will source", /Do not wait for a typed restatement of will/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/engine-dna.ts"), "utf8")));

console.log("========================================");
console.log(`INFERRED SEEDS: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
