/**
 * ORDER 1 minimal offline self-check (no xAI call)
 */
import { readFileSync } from "fs";

const index = readFileSync("supabase/functions/generate-post/index.ts", "utf8");
const stages = readFileSync("supabase/functions/generate-post/thought-stages.ts", "utf8");
const grounding = readFileSync("supabase/functions/generate-post/grounding-out.ts", "utf8");

const checks = [
  ["thought-stages module exists", stages.includes("buildThoughtStagesInstructions")],
  ["Core Thought instructions present", stages.includes("CORE THOUGHT")],
  ["Thinking Rail library present", stages.includes("THINKING_RAIL_LIBRARY")],
  ["Audience Translation present", stages.includes("AUDIENCE TRANSLATION")],
  ["Writing DNA limited to final expression", stages.includes("FINAL EXPRESSION ONLY") || index.includes("FINAL EXPRESSION ONLY")],
  ["index imports thought-stages", index.includes('from "./thought-stages.ts"')],
  ["generator version order1", index.includes("core_thought_rail_audience_v1_order1")],
  ["output fields required in prompt", index.includes("core_thought") && index.includes("thinking_rail") && index.includes("audience_translation")],
  ["grounding-out passes stage fields", grounding.includes("core_thought") && grounding.includes("thinking_rail")],
  ["no independent new engine class", !stages.includes("class ThoughtEngine") && !index.includes("new ThoughtEngine")],
];

let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
  if (!ok) fail++;
}
console.log(fail === 0 ? "\nORDER1 offline self-check: ALL PASS" : `\nORDER1 offline self-check: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
