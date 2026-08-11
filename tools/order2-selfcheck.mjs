/**
 * ORDER 2 minimal offline self-check (no xAI call)
 */
import { readFileSync } from "fs";

const index = readFileSync("supabase/functions/generate-post/index.ts", "utf8");
const humor = readFileSync("supabase/functions/generate-post/natural-humor-density.ts", "utf8");
const grounding = readFileSync("supabase/functions/generate-post/grounding-out.ts", "utf8");
const stages = readFileSync("supabase/functions/generate-post/thought-stages.ts", "utf8");

const checks = [
  ["natural-humor-density module exists", humor.includes("buildNaturalHumorAndDensityInstructions")],
  ["humor not forced", humor.includes("If no suitable natural point exists")],
  ["humor does not change Core Thought", humor.includes("Do NOT change Core Thought")],
  ["HUMOR mode separation", index.includes("never change editorial_mode because humor") || humor.includes("Do NOT change Editorial Mode")],
  ["writing density instructions", humor.includes("FINAL WRITING DENSITY")],
  ["creator fit guidance", humor.includes("CREATOR FIT")],
  ["diagnoseHumorAndDensity present", humor.includes("diagnoseHumorAndDensity")],
  ["grounding-out has natural_humor_fit", grounding.includes("natural_humor_fit")],
  ["ORDER1 stages still present", stages.includes("CORE THOUGHT")],
  ["no humor bonus auto-boost language", !humor.includes("always prefer humor") && !index.includes("humor_bonus")],
];

let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
  if (!ok) fail++;
}
console.log(fail === 0 ? "\nORDER2 offline self-check: ALL PASS" : `\nORDER2 offline self-check: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
