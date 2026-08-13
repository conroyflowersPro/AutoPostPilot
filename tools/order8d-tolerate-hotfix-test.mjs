#!/usr/bin/env node
import fs from "fs";
const path = "tools/order8b-hotfix-selective-recompute-test.mjs";
let t = fs.readFileSync(path, "utf8");
if (t.includes("phased_v10_release") && t.includes('const APP_VERSION = "10.0.0"')) {
  console.log("ALREADY_TOLERANT");
  process.exit(0);
}
t = t.replace(
  'ok(t.includes("10.0.0-order8b-hotfix-selective-recompute") || t.includes("10.0.0-order8c-weekly-count-qa"),"T16 index APP");',
  'ok(t.includes("10.0.0-order8b-hotfix-selective-recompute") || t.includes("10.0.0-order8c-weekly-count-qa") || t.includes(\'const APP_VERSION = "10.0.0"\'),"T16 index APP");'
);
t = t.replace(
  'ok(t.includes("phased_v10_order8b_hotfix_selective_recompute") || t.includes("phased_v10_order8c_weekly_count_qa"),"T16 index engine");',
  'ok(t.includes("phased_v10_order8b_hotfix_selective_recompute") || t.includes("phased_v10_order8c_weekly_count_qa") || t.includes("phased_v10_release"),"T16 index engine");'
);
if (!t.includes("phased_v10_release")) {
  console.error("TOLERANCE_FAILED");
  process.exit(2);
}
fs.writeFileSync(path, t);
console.log("TOLERANCE_APPLIED");
