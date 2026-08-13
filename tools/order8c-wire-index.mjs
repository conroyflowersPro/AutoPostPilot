/**
 * ORDER 8C — minimal wire of weekly-count-ledger into weekly-plan/index.ts
 */
import fs from "fs";
const path = "supabase/functions/weekly-plan/index.ts";
let t = fs.readFileSync(path, "utf8");
if (t.includes("weekly-count-ledger") && t.includes("ORDER8C_VERSION")) {
  console.log("ALREADY_WIRED");
  process.exit(0);
}

const importNeedle = `} from "./selective-regeneration.ts";`;
const importInsert = `} from "./selective-regeneration.ts";
import {
  buildWeeklyPublicationSummary,
  evaluateOrder8cCompletionGate,
  ORDER8C_VERSION,
  preserveSlotCountNoFakeContent,
} from "./weekly-count-ledger.ts";`;
if (!t.includes('from "./weekly-count-ledger.ts"')) {
  if (!t.includes(importNeedle)) {
    console.error("MISSING_IMPORT_NEEDLE");
    process.exit(2);
  }
  t = t.replace(importNeedle, importInsert);
}

t = t.replace(
  'const APP_VERSION = "10.0.0-order8b-hotfix-selective-recompute";',
  'const APP_VERSION = "10.0.0-order8c-weekly-count-qa";'
);
t = t.replace(
  'const WEEKLY_ENGINE_VERSION = "phased_v10_order8b_hotfix_selective_recompute";',
  'const WEEKLY_ENGINE_VERSION = "phased_v10_order8c_weekly_count_qa";'
);

// After completion_gate_final, enrich with ORDER 8C ledger before return json select
const gateNeedle = `const completion_gate_final = evaluateWeeklyCompletionGate(
        redistributed.days.flatMap((d) => d.posts || []),
        required_slots,
      );`;
const gateInsert = `const completion_gate_final = evaluateWeeklyCompletionGate(
        redistributed.days.flatMap((d) => d.posts || []),
        required_slots,
      );
      const flatSlots8c = redistributed.days.flatMap((d) => d.posts || []);
      const order8c_gate = evaluateOrder8cCompletionGate({
        requested_slots: required_slots,
        planner_slots: mix.base_required_slots,
        slots: flatSlots8c as any[],
      });
      const order8c_summary = buildWeeklyPublicationSummary({
        requested_slots: required_slots,
        slots: flatSlots8c as any[],
      });`;
if (t.includes(gateNeedle) && !t.includes("order8c_gate")) {
  t = t.replace(gateNeedle, gateInsert);
}

// Inject diagnostics keys near order8b_version in select diagnostics only
if (!t.includes("order8c_version")) {
  t = t.replace(
    "order8b_version: ORDER8B_VERSION,",
    `order8b_version: ORDER8B_VERSION,
          order8c_version: ORDER8C_VERSION,
          order8c_count_integrity_pass: order8c_gate.pass,
          order8c_ledger: order8c_gate.ledger,
          order8c_summary: {
            requested_slots: order8c_summary.requested_slots,
            returned_slots: order8c_summary.returned_slots,
            publishable_slots: order8c_summary.publishable_slots,
            blocked_slots: order8c_summary.blocked_slots,
            judge_unavailable_slots: order8c_summary.judge_unavailable_slots,
            count_integrity_pass: order8c_summary.count_integrity_pass,
            weekly_quality_warnings: order8c_summary.weekly_quality_warnings,
          },`
  );
}

fs.writeFileSync(path, t);
const checks = [
  t.includes('from "./weekly-count-ledger.ts"'),
  t.includes("ORDER8C_VERSION"),
  t.includes("order8c_gate"),
  t.includes("10.0.0-order8c-weekly-count-qa"),
  t.includes("phased_v10_order8c_weekly_count_qa"),
];
console.log("WIRE", checks);
if (checks.some((c) => !c)) process.exit(10);
console.log("WIRE_OK", t.length);
