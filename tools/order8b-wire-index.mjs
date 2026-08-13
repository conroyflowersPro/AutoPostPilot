/**
 * Materialize ORDER 8B wiring into weekly-plan/index.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "supabase/functions/weekly-plan/index.ts");
let src = fs.readFileSync(indexPath, "utf8");

if (src.includes("ORDER8B_VERSION") && src.includes("routeSlotWithRegeneration")) {
  console.log("Already wired ORDER 8B");
  process.exit(0);
}
if (!src.includes('from "./semantic-judge.ts"')) {
  console.error("ORDER 8A import missing — abort");
  process.exit(1);
}

const imp = `} from "./semantic-judge.ts";
import {
  routeSlotWithRegeneration,
  decideRegenerationRoute,
  ORDER8B_VERSION,
  type RoutedSlotResult,
} from "./regeneration-router.ts";
`;
src = src.replace('} from "./semantic-judge.ts";\n', imp);

src = src.replace(
  'const APP_VERSION = "10.0.0-order8a-semantic-judge";',
  'const APP_VERSION = "10.0.0-order8b-rejection-routing";\nconst APP_VERSION_ORDER8A_COMPAT = "10.0.0-order8a-semantic-judge";',
);
src = src.replace(
  'const WEEKLY_ENGINE_VERSION = "phased_v10_order8a_semantic_judge";',
  'const WEEKLY_ENGINE_VERSION = "phased_v10_order8b_rejection_routing";\n// regression: phased_v10_order8a_semantic_judge',
);
src = src.replace(
  "const independent_generation: IndependentPostResult = integrated.independent ||",
  "let independent_generation: IndependentPostResult = integrated.independent ||",
);

const inject = `
  // ORDER 8B: Rejection & Regeneration Routing
  let routed: RoutedSlotResult | null = null;
  try {
    routed = await routeSlotWithRegeneration({
      slot_id: independent_generation.slot_id,
      context_id: independent_generation.context_id,
      ctx: deep_generation,
      initial_independent: independent_generation,
      initial_judge: semantic_judge_result!,
      executeRegen: async (decision, _attempt) => {
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
      },
    });
    if (routed && (routed.slot_final_state === "ACCEPTED_PASS" || routed.slot_final_state === "ACCEPTED_WITH_CONCERNS" || routed.slot_final_state === "REGENERATED_PASS")) {
      independent_generation = routed.independent || independent_generation;
      semantic_judge_result = routed.judge || semantic_judge_result;
    } else if (routed && (routed.slot_final_state === "BLOCKED" || routed.slot_final_state === "JUDGE_UNAVAILABLE")) {
      independent_generation = {
        ...independent_generation,
        final_text: "",
        generation_status: "GENERATION_BLOCKED" as any,
        block_reasons: [...(independent_generation.block_reasons || []), "order8b_" + String(routed.slot_final_state).toLowerCase()],
      };
      if (routed.judge) semantic_judge_result = routed.judge;
    }
  } catch {
    routed = null;
  }
`;

const needle = 'judge_error: "judge_attach_exception",\n      judge_mode: "unavailable",\n    };\n  }\n\n  return {';
const repl = 'judge_error: "judge_attach_exception",\n      judge_mode: "unavailable",\n    };\n  }\n' + inject + '\n  return {';
if (!src.includes(needle)) {
  console.error("needle not found for inject");
  process.exit(1);
}
src = src.replace(needle, repl);

src = src.replace(
  'judge_conceptual_repetition: semantic_judge_result?.flags?.conceptual_repetition ?? "LOW",',
  'judge_conceptual_repetition: semantic_judge_result?.flags?.conceptual_repetition ?? "LOW",\n    order8b_version: ORDER8B_VERSION,\n    semantic_regen_attempts: routed?.semantic_regen_attempts ?? 0,\n    last_route: routed?.last_route ?? "NO_ACTION",\n    slot_final_state: routed?.slot_final_state ?? "PENDING",\n    regeneration_exhausted: routed?.regeneration_exhausted ?? false,',
);
src = src.replace(
  "order8a_no_auto_regeneration: true,",
  "order8a_no_auto_regeneration: true,\n          order8b_rejection_routing: true,\n          order8b_version: ORDER8B_VERSION,",
);

fs.writeFileSync(indexPath, src);
console.log("Wired ORDER 8B", src.length);
