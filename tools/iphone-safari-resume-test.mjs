#!/usr/bin/env node
/**
 * iPhone Safari is the primary client.
 * Safari TypeError "Load failed" must resume the weekly job, not stop it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";

const ROOT = process.cwd();
const helperSrc = readFileSync(path.join(ROOT, "lib/transient-edge-error.ts"), "utf8");
const gen = readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8");
const ver = readFileSync(path.join(ROOT, "lib/version.ts"), "utf8");
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");

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

const js = helperSrc
  .replace(/\(err as \{[^}]+\}\)/g, "err")
  .replace(/: unknown/g, "")
  .replace(/: string/g, "")
  .replace(/: boolean/g, "");
const tmp = path.join(os.tmpdir(), `transient-edge-error-${Date.now()}.mjs`);
writeFileSync(tmp, js);
const { isTransientEdgeError, koreanEdgeError } = await import(pathToFileURL(tmp).href);
unlinkSync(tmp);

function typeErr(message) {
  const e = new TypeError(message);
  return e;
}

console.log("iPhone Safari resume (v11.3.4)");
ok("S1. Safari Load failed is transient", isTransientEdgeError(typeErr("Load failed")));
ok("S2. Failed to fetch is transient", isTransientEdgeError(typeErr("Failed to fetch")));
ok("S3. NetworkError is transient", isTransientEdgeError(new Error("NetworkError when attempting to fetch resource.")));
ok("S4. AbortError is transient", isTransientEdgeError(Object.assign(new Error("aborted"), { name: "AbortError" })));
ok("S5. Korean tick timeout is transient", isTransientEdgeError(new Error("job_tick이 55초 안에 끝나지 않았습니다.")));
ok("S6. real job failure is not transient", !isTransientEdgeError(new Error("주간 생성 실패")));
ok("S7. red box is Korean not Load failed", !/Load failed/i.test(koreanEdgeError(typeErr("Load failed"))) && /사파리/.test(koreanEdgeError(typeErr("Load failed"))));
ok("S8. generate page imports helper", /from "@\/lib\/transient-edge-error"/.test(gen));
ok("S9. followJob resumes on any transient drop", /if \(!isTransientEdgeError\(e\)\) throw e/.test(gen) && /phase: "job_status"/.test(gen));
ok("S10. job_start drop polls status then follows", /phase: "job_start"/.test(gen) && /isTransientEdgeError\(e\)/.test(gen) && /다시 눌러 주세요/.test(gen));
ok("S11. setError uses koreanEdgeError", /setError\(koreanEdgeError\(e\)\)/.test(gen));
ok("S12. job_status retries 3 times", /phaseName === "job_status" \? 3 : 1/.test(gen));
ok("S13. version lockstep 11.5.6", /APP_VERSION = "11.5.6"/.test(ver) && /APP_VERSION = "11.5.6"/.test(ix));
ok("S14. helper documents iPhone Safari as primary", /iPhone Safari is the primary client/.test(helperSrc));
ok("S15. Korean timeout copy is kept as-is", koreanEdgeError(new Error("job_tick이 55초 안에 끝나지 않았습니다.")) === "job_tick이 55초 안에 끝나지 않았습니다.");

console.log("========================================");
console.log(`SAFARI RESUME: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
