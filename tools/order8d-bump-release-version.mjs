#!/usr/bin/env node
import fs from "fs";
const path = "supabase/functions/weekly-plan/index.ts";
let t = fs.readFileSync(path, "utf8");
const before = t;
t = t.replace(
  /const APP_VERSION = "10\.0\.0-order8c-weekly-count-qa";/,
  'const APP_VERSION = "10.0.0";'
);
t = t.replace(
  /const WEEKLY_ENGINE_VERSION = "phased_v10_order8c_weekly_count_qa";/,
  'const WEEKLY_ENGINE_VERSION = "phased_v10_release";'
);
if (t === before) {
  if (t.includes('const APP_VERSION = "10.0.0";') && t.includes("phased_v10_release")) {
    console.log("ALREADY_RELEASE");
    process.exit(0);
  }
  console.error("BUMP_NEEDLES_MISSING");
  process.exit(2);
}
fs.writeFileSync(path, t);
console.log("BUMPED_TO_10.0.0");
