#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const judge = read("supabase/functions/weekly-plan/semantic-judge.ts");
const wr = read("supabase/functions/weekly-plan/independent-post-generation.ts");
const scope = read("supabase/functions/weekly-plan/seed-scope.ts");
const ver = read("lib/version.ts");
const ix = read("supabase/functions/weekly-plan/index.ts");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass += 1;
    console.log("  PASS ", name);
  } else {
    fail += 1;
    console.log("  FAIL ", name);
  }
}

console.log("Judge context pass (v12.2.2)");
ok("J1. seed title mismatch is soft", /seed_title_not_in_prose/.test(judge) && !/hard\.push\("seed_meaning_departure"\)/.test(judge));
ok("J2. Writer does not hard-fail seed_fidelity_weak", !/reasons\.push\("seed_fidelity_weak"\)/.test(wr));
ok("J3. bait closer is last sentence", /isEngagementBaitCloser/.test(judge) && /lastSentenceKo/.test(scope));
ok("J4. jargon hard fail is density 2+", /deepJargonCount\(text\) >= 2/.test(scope) && /expert_jargon_once/.test(judge));
ok("J5. version 12.2.2", /APP_VERSION = "12.2.2"/.test(ver) && /APP_VERSION = "12.2.2"/.test(ix));

console.log("========================================");
console.log(`JUDGE CONTEXT: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
