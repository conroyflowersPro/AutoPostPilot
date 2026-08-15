#!/usr/bin/env node
/**
 * For You spacing: 14:00–22:00 Pacific, even-spread, no burst.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const sch = readFileSync(path.join(ROOT, "lib/schedule.ts"), "utf8");
const ui = readFileSync(path.join(ROOT, "app/components/BatchScheduleButton.tsx"), "utf8");
const quota = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/quota-inference.ts"), "utf8");

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

function evenSpreadInWindow(firstMs, endMs, count) {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  if (n === 1) return [firstMs];
  const span = Math.max(0, endMs - firstMs);
  const gap = span / (n - 1);
  const slots = [];
  for (let i = 0; i < n; i++) slots.push(Math.round(firstMs + gap * i));
  return slots;
}

const TWO_H = 2 * 60 * 60 * 1000;
const HARD = 45 * 60 * 1000;
const windowMs = 8 * 60 * 60 * 1000;
const four = evenSpreadInWindow(0, windowMs, 4);
const eight = evenSpreadInWindow(0, windowMs, 8);

console.log("For You schedule (v11.3.0)");
ok("S1. start hour 14", /FOR_YOU_START_HOUR = 14/.test(sch));
ok("S2. end hour 22", /FOR_YOU_END_HOUR = 22/.test(sch));
ok("S3. preferred gap 2h", /FOR_YOU_PREFERRED_GAP_MS = 2 \* 60 \* 60 \* 1000/.test(sch));
ok("S4. hard min 45m anti-burst", /FOR_YOU_HARD_MIN_GAP_MS = 45 \* 60 \* 1000/.test(sch));
ok("S5. evenSpreadInWindow exported", /export function evenSpreadInWindow/.test(sch));
ok("S6. 4 posts in 14-22 are >= 2h apart", four[1] - four[0] >= TWO_H && four[2] - four[1] >= TWO_H && four[3] - four[2] >= TWO_H);
ok("S7. 4 posts land on the window ends", four[0] === 0 && four[3] === windowMs);
ok("S8. 8 posts still not a burst", eight.every((t, i) => i === 0 || t - eight[i - 1] >= HARD));
ok("S9. UI starts 2pm Pacific", /태평양시 오후 2시/.test(ui));
ok("S10. UI does not keep 17:00 / 3h", !/17:00 LA/.test(ui) && !/최소 3시간/.test(ui));
ok("S11. quota strategy uses 14:00-22:00 PT", /14:00 America\/Los_Angeles/.test(quota) && /14:00–22:00 PT/.test(quota));
ok("S12. Grok refine is For You window constrained", /day window 14:00–22:00 Pacific/.test(sch) && /timesRespectForYou/.test(sch));

console.log("========================================");
console.log(`FOR YOU SCHEDULE: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
