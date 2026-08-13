/**
 * ORDER 8B HOTFIX — surgical wire of selective-regeneration into weekly-plan/index.ts
 * Does NOT rewrite unrelated sections.
 */
import fs from "fs";

const path = "supabase/functions/weekly-plan/index.ts";
let t = fs.readFileSync(path, "utf8");
const before = t.length;

if (t.includes("executeSelectiveRegeneration") && t.includes("snapshotFromSlotParts") && t.includes("10.0.0-order8b-hotfix-selective-recompute")) {
  console.log("ALREADY_WIRED", t.length);
  process.exit(0);
}

const importNeedle = `} from "./regeneration-router.ts";`;
const importInsert = `} from "./regeneration-router.ts";
import {
  executeSelectiveRegeneration,
  snapshotFromSlotParts,
  ORDER8B_HOTFIX_VERSION,
} from "./selective-regeneration.ts";`;
if (!t.includes('from "./selective-regeneration.ts"')) {
  if (!t.includes(importNeedle)) {
    console.error("MISSING_IMPORT_NEEDLE");
    process.exit(2);
  }
  t = t.replace(importNeedle, importInsert);
}

t = t.replace(
  'const APP_VERSION = "10.0.0-order8b-rejection-routing";',
  'const APP_VERSION = "10.0.0-order8b-hotfix-selective-recompute";'
);
t = t.replace(
  'const WEEKLY_ENGINE_VERSION = "phased_v10_order8b_rejection_routing";',
  'const WEEKLY_ENGINE_VERSION = "phased_v10_order8b_hotfix_selective_recompute";'
);

const oldRegen = `      executeRegen: async (decision, _attempt) => {
        const regen = await generateIndependentPost(deep_generation, {
          dry_run: genOpts?.dry_run === true,
          xai_key: genOpts?.xai_key ?? null,
          allow_one_retry: false,
        });
        if (decision.rejection_codes?.length) {
          regen.block_reasons = [...(regen.block_reasons || []), ...decision.rejection_codes.map((c: string) => "regen:" + c)];
        }
        const j2 = judgeIndependentResult(deep_generation, regen, undefined, {
          xai_key: (genOpts as any)?.xai_key ?? null,
        });
        return { independent: regen, judge: j2 };
      },`;

const newRegen = `      executeRegen: async (decision, _attempt) => {
        const snap = snapshotFromSlotParts({
          slot_id: independent_generation.slot_id,
          context_id: independent_generation.context_id || deep_generation?.context_id,
          seed: seed as any,
          editorial_mode: mode,
          interpretation: seed_interpretation as any,
          reaction_mechanism: reaction_mechanism as any,
          thinking_rail: thinking_rail as any,
          everyday_language: everyday_language as any,
          creator_style: creator_style as any,
          natural_humor: natural_humor as any,
          deep_context: deep_generation,
        });
        const sel = await executeSelectiveRegeneration({
          snapshot: snap,
          decision,
          genOpts: {
            dry_run: genOpts?.dry_run === true,
            xai_key: genOpts?.xai_key ?? null,
          },
        });
        if (sel.deep_context) {
          deep_generation = sel.deep_context;
        }
        return { independent: sel.independent, judge: sel.judge };
      },`;

if (t.includes(oldRegen)) {
  t = t.replace(oldRegen, newRegen);
} else if (!t.includes("executeSelectiveRegeneration")) {
  const start = t.indexOf("executeRegen: async (decision, _attempt) => {");
  if (start < 0) { console.error("NO_EXECUTE_REGEN_START"); process.exit(4); }
  let end = t.indexOf("return { independent: regen, judge: j2 };", start);
  if (end < 0) { console.error("NO_REGEN_RETURN"); process.exit(6); }
  end = t.indexOf("},", end);
  if (end < 0) { console.error("NO_REGEN_END"); process.exit(7); }
  end = end + 2;
  t = t.slice(0, start) + newRegen.trimStart() + t.slice(end);
}

if (!t.includes("order8b_hotfix_version")) {
  t = t.replace(
    "order8b_version: ORDER8B_VERSION,",
    "order8b_version: ORDER8B_VERSION,\n    order8b_hotfix_version: ORDER8B_HOTFIX_VERSION,"
  );
}
if (!t.includes("order8b_hotfix_selective_recompute")) {
  t = t.replace(
    "order8b_rejection_routing: true,",
    "order8b_rejection_routing: true,\n          order8b_hotfix_selective_recompute: true,\n          order8b_hotfix_version: ORDER8B_HOTFIX_VERSION,"
  );
}

fs.writeFileSync(path, t);
const checks = [
  t.includes('from "./selective-regeneration.ts"'),
  t.includes("executeSelectiveRegeneration"),
  t.includes("snapshotFromSlotParts"),
  t.includes("10.0.0-order8b-hotfix-selective-recompute"),
  t.includes("phased_v10_order8b_hotfix_selective_recompute"),
  t.includes("order8b_hotfix_version"),
  !t.includes("PLACEHOLDER"),
];
console.log("WIRE_RESULT", { before, after: t.length, checks });
if (checks.some((c) => !c)) process.exit(10);
console.log("WIRE_OK");
