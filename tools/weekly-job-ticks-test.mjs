#!/usr/bin/env node
/**
 * v11.2.0 — text weekly generate is a persisted job; each Edge invoke is one tick.
 * Video is out of scope.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ix = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/index.ts"), "utf8");
const job = readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/generation-job.ts"), "utf8");
const gen = readFileSync(path.join(ROOT, "app/generate/page.tsx"), "utf8");
const sql = readFileSync(path.join(ROOT, "supabase/migrations/20260814_generation_jobs_v1.sql"), "utf8");
const wf = path.join(ROOT, ".github/workflows/apply-generation-jobs-migration.yml");

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

console.log("Weekly job ticks (v11.2.0 text only)");
ok("J1. generation_jobs table", /create table if not exists public\.generation_jobs/.test(sql));
ok("J2. RLS own rows", /auth\.uid\(\) = user_id/.test(sql));
ok("J3. Edge job_start / job_tick / job_status", /phase === "job_start"/.test(ix) && /phase === "job_tick"/.test(ix) && /phase === "job_status"/.test(ix));
ok("J4. ticks are one step", /if \(row\.step === "quota"\)/.test(job) && /else if \(row\.step === "expand"\)/.test(job) && /else if \(row\.step === "write"\)/.test(job));
ok("J5. expand timeout 32s on job tick", /timeoutMs: 32000/.test(job));
ok("J6. write chunk 2", /const WRITE_CHUNK = 2/.test(job));
ok("J7. drafts insert on write tick", /from\("SeungContent"\)\.insert/.test(job) && /job_id: row\.id/.test(job));
ok("J8. empty drafts are not saved", /if \(!text\)/.test(job) && /빈 초안/.test(job));
ok("J9. no template fill on empty expand", /템플릿으로 채우지 않습니다/.test(job));
ok("J10. client starts a job then follows ticks", /phase: "job_start"/.test(gen) && /phase: "job_tick"/.test(gen));
ok("J11. client does not orchestrate quota/expand/write", !/phase: "quota"/.test(gen) && !/phase: "expand"/.test(gen) && !/phase: "write"/.test(gen));
ok("J12. client aborts job_tick ~55s", /job_tick/.test(gen) && /55000/.test(gen));
ok("J13. refresh resumes running job", /phase: "job_status"/.test(gen) && /status !== "running"/.test(gen));
ok("J14. tick timeout polls status instead of wiping the week", /job_status/.test(gen) && /초 안에 끝나지 않았습니다/.test(gen));
ok("J15. shipping 11.2.6", /const APP_VERSION = "11.2.6"/.test(ix));
ok("J16. video not implemented", /Video is out of scope/.test(job) && !/job_type.*video/.test(job));
ok("J17. migration apply workflow", existsSync(wf));
ok("J18. learning line on quota tick", /학습:/.test(job));
ok("J19. job connects lived experience cite-seeds", /buildRecentExperienceCandidates/.test(job));
ok("J20. adjacent fill does not abort 22/28", /인접 확장으로 할당량 보충/.test(job) && !/할당량을 채운 뒤에만 저장합니다/.test(job));
ok("J21. shortfall goes to review", /리뷰:/.test(job) && /빈 칸은 작성하지 않음/.test(job));
ok("J22. leftover selectable seeds fill quota holes", /while \(totalPlanned < required && pool\.length > 0\)/.test(job));
ok("J23. experience-without-evidence remints to INFORMATIVE", /onlyMissingLived/.test(job) && /NO_CREATOR_EVIDENCE/.test(job));

console.log("========================================");
console.log(`JOB TICKS: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
