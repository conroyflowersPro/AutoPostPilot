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
ok("J3. Edge job_start / job_tick / job_status / job_stop", /phase === "job_start"/.test(ix) && /phase === "job_tick"/.test(ix) && /phase === "job_status"/.test(ix) && /phase === "job_stop"/.test(ix));
ok("J4. ticks are one step", /if \(row\.step === "quota"\)/.test(job) && /else if \(row\.step === "expand"\)/.test(job) && /else if \(row\.step === "write"\)/.test(job));
ok("J5. expand timeout 40s on job tick", /timeoutMs: compact \? 20000 : 40000/.test(job));
ok("J6. write chunk 1", /const WRITE_CHUNK = 1/.test(job));
ok("J7. drafts insert on write tick", /from\("SeungContent"\)\.insert/.test(job) && /job_id: row\.id/.test(job));
ok("J8. empty drafts are not saved", /if \(!text\)/.test(job) && /빈 초안/.test(job));
ok("J9. no template fill on empty expand", /템플릿으로 채우지 않습니다/.test(job));
ok("J10. client starts a job then follows ticks", /phase: "job_start"/.test(gen) && /phase: "job_tick"/.test(gen));
ok("J11. client does not orchestrate quota/expand/write", !/phase: "quota"/.test(gen) && !/phase: "expand"/.test(gen) && !/phase: "write"/.test(gen));
ok("J12. client aborts job_tick ~90s", /job_tick/.test(gen) && /90000/.test(gen));
ok("J13. refresh resumes running job", /phase: "job_status"/.test(gen) && /status !== "running"/.test(gen));
ok("J14. tick timeout polls status instead of wiping the week", /job_status/.test(gen) && /초 안에 끝나지 않았습니다/.test(gen));
ok("J15. shipping 12.3.0", /const APP_VERSION = "12.3.0"/.test(ix));
ok("J24. empty write returns to Planner and never reports a short success", /pending_recovery/.test(job) && /row\.step = "recover"/.test(job) && /quotaFilled/.test(job));
ok("J25. live Planner has no local HIGH repetition gate", !/conceptualRepetitionLevel/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/seven-day-planner.ts"), "utf8")));
ok("J26. client followJob 200 ticks", /for \(let i = 0; i < 200; i\+\+\)/.test(gen));
ok("J27. Load failed is treated as resume not a hard stop", /isTransientEdgeError/.test(gen) && /Load failed/i.test(readFileSync(path.join(ROOT, "lib/transient-edge-error.ts"), "utf8")));
ok("J28. followJob resumes on Safari drop not only Korean timeout", /if \(!isTransientEdgeError\(e\)\) throw e/.test(gen) && /사파리 연결이 잠깐 끊겼습니다/.test(gen));
ok("J29. job_start Load failed polls job_status", /phase: "job_start"/.test(gen) && /phase: "job_status"/.test(gen) && /다시 눌러 주세요/.test(gen));
ok("J30. red box never dumps English Load failed", /setError\(koreanEdgeError\(e\)\)/.test(gen) && !/setError\(e\?\.message/.test(gen));
ok("J31. job_status retries after Safari drop", /phaseName === "job_status" \? 3 : 1/.test(gen));
ok("J16. video not implemented", /Video is out of scope/.test(job) && !/job_type.*video/.test(job));
ok("J17. migration apply workflow", existsSync(wf));
ok("J18. learning line on quota tick", /학습:/.test(job));
ok("J19. job connects 30d Analytics lived seeds", /analyticsLivedSeeds/.test(job));
ok("J20. Planner-targeted exploration replaces random humor fill", /Planner 지정 분야 Seed 추가 탐색/.test(job) && !/localHumorKeywordSeeds/.test(job));
ok("J21. Seed shortage returns to Planner field direction", /planner_exploration_direction/.test(job) && /planner_missing_count/.test(job));
ok("J22. Planner recovery receives existing Seed Pool first", /recoverSeedPool\(st\)/.test(job) && /attachSeedsForSlots/.test(job));
ok("J23. unsupported experience remains a Writer evidence boundary", /verification_requirements/.test(readFileSync(path.join(ROOT, "supabase/functions/weekly-plan/order-write-pipeline.ts"), "utf8")));
ok("J32. write shortfall uses Creator DNA then Planner Seeds", /pending_recovery/.test(job) && /creatorRelabelRejectBatch/.test(job));
ok("J33. Planner never completes an underfilled selection", /Planner 배차 미완/.test(job) && /flat\.length !== strategy\.slots\.length/.test(job));
ok("J34. expand/recovery are bounded; only saved quota can complete", /EXPAND_HARD_CAP = 36/.test(job) && /pending\.attempts > 4/.test(job) && /function quotaFilled/.test(job));
ok("J35. job_status exposes report_ko", /report_ko/.test(job) && /생성 보고서/.test(job));
ok("J36. deploy retires unstamped or other-version running jobs", /retireStaleRunningJob/.test(job) && /배포로 이전 생성을 멈췄습니다/.test(job) && /app_version: args\.appVersion/.test(job));
ok("J37. operator can stop a running job", /stopWeeklyJob/.test(job) && /멈추기/.test(gen) && /phase: "job_stop"/.test(gen));
ok("J38. Planner select timeout uses pool instead of looping field explore", /fillUnassignedPlannerSlotsFromPool/.test(job) && /explored_missing/.test(job));
ok("J39. lived pool is not collapsed by abstract subject", /lived:\$\{String\(seed\.seed_id/.test(job));

console.log("========================================");
console.log(`JOB TICKS: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
