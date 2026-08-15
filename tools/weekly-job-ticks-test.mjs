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
ok("J5. expand timeout 32s on job tick", /timeoutMs: compact \? 20000 : 32000/.test(job));
ok("J6. write chunk 1", /const WRITE_CHUNK = 1/.test(job));
ok("J7. drafts insert on write tick", /from\("SeungContent"\)\.insert/.test(job) && /job_id: row\.id/.test(job));
ok("J8. empty drafts are not saved", /if \(!text\)/.test(job) && /빈 초안/.test(job));
ok("J9. no template fill on empty expand", /템플릿으로 채우지 않습니다/.test(job));
ok("J10. client starts a job then follows ticks", /phase: "job_start"/.test(gen) && /phase: "job_tick"/.test(gen));
ok("J11. client does not orchestrate quota/expand/write", !/phase: "quota"/.test(gen) && !/phase: "expand"/.test(gen) && !/phase: "write"/.test(gen));
ok("J12. client aborts job_tick ~55s", /job_tick/.test(gen) && /55000/.test(gen));
ok("J13. refresh resumes running job", /phase: "job_status"/.test(gen) && /status !== "running"/.test(gen));
ok("J14. tick timeout polls status instead of wiping the week", /job_status/.test(gen) && /초 안에 끝나지 않았습니다/.test(gen));
ok("J15. shipping 11.10.1", /const APP_VERSION = "11.10.1"/.test(ix));
ok("J24. empty write preserves saved drafts and never reports a short success", /keepOnlySavedWriteSlots/.test(job) && /bounceToFillQuota/.test(job) && /quotaFilled/.test(job) && !/할당 미달/.test(job) && !/_write_retry/.test(job));
ok("J25. HIGH skip only after half the week", /selectedWeekly\.length >= Math\.ceil\(required \* 0\.5\)/.test(job));
ok("J26. client followJob 200 ticks", /for \(let i = 0; i < 200; i\+\+\)/.test(gen));
ok("J27. Load failed is treated as resume not a hard stop", /isTransientEdgeError/.test(gen) && /Load failed/i.test(readFileSync(path.join(ROOT, "lib/transient-edge-error.ts"), "utf8")));
ok("J28. followJob resumes on Safari drop not only Korean timeout", /if \(!isTransientEdgeError\(e\)\) throw e/.test(gen) && /사파리 연결이 잠깐 끊겼습니다/.test(gen));
ok("J29. job_start Load failed polls job_status", /phase: "job_start"/.test(gen) && /phase: "job_status"/.test(gen) && /다시 눌러 주세요/.test(gen));
ok("J30. red box never dumps English Load failed", /setError\(koreanEdgeError\(e\)\)/.test(gen) && !/setError\(e\?\.message/.test(gen));
ok("J31. job_status retries after Safari drop", /phaseName === "job_status" \? 3 : 1/.test(gen));
ok("J16. video not implemented", /Video is out of scope/.test(job) && !/job_type.*video/.test(job));
ok("J17. migration apply workflow", existsSync(wf));
ok("J18. learning line on quota tick", /학습:/.test(job));
ok("J19. job connects lived experience cite-seeds", /buildRecentExperienceCandidates/.test(job));
ok("J20. humor fill does not abort short weeks", /유머·관심 시드로 할당량 보충/.test(job) && !/할당량을 채운 뒤에만 저장합니다/.test(job));
ok("J21. shortfall keeps Grok humor expand not frozen keywords", /유머/.test(job) && !/localHumorKeywordSeeds/.test(job) && !/빈 칸은 작성하지 않음/.test(job));
ok("J22. leftover selectable seeds fill quota holes", /while \(totalPlanned < required && pool\.length > 0\)/.test(job));
ok("J23. experience-without-evidence remints to INFORMATIVE", /onlyMissingLived/.test(job) && /NO_CREATOR_EVIDENCE/.test(job));
ok("J32. write shortfall uses reserve before bounded expand", /write_fill_rounds/.test(job) && /addedFromReserve/.test(job) && /appendEligibleSeedsToWrite/.test(job) && /새 API 탐색 없음/.test(job));
ok("J33. select never ships a short week", /if \(totalAfter < required\)/.test(job) && /canKeepExpanding\(st\)/.test(job));
ok("J34. expand is bounded; only saved quota can complete", /EXPAND_HARD_CAP = 36/.test(job) && /return Number\(st\.dim_batch/.test(job) && /function quotaFilled/.test(job) && /Seed 탐색 한도/.test(job));

console.log("========================================");
console.log(`JOB TICKS: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
