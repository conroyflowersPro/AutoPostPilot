import fs from 'node:fs';
const ui = fs.readFileSync('app/generate/page.tsx','utf8');
const idx = fs.readFileSync('supabase/functions/weekly-plan/index.ts','utf8');
const regen = fs.readFileSync('supabase/functions/weekly-plan/selective-regeneration.ts','utf8');
const router = fs.readFileSync('supabase/functions/weekly-plan/regeneration-router.ts','utf8');
let pass=0, fail=0;
function t(name, ok){ if(ok){console.log('PASS',name);pass++;} else {console.log('FAIL',name);fail++;} }
t('UI does not regenerate judged v11 slots via legacy generate-post', !ui.includes('/functions/v1/generate-post'));
t('UI persists weekly-plan final_text directly', ui.includes('const text = String(p.final_text || "").trim()'));
t('UI refuses blocked/rejected slots', ui.includes('finalState === "BLOCKED"') && ui.includes('judgeStatus === "REJECT"'));
t('select diagnostics infer seed expansion from seed provenance', idx.includes('expandedSeedPresent'));
t('select diagnostics no longer hardcode seed_expansion false at final response', idx.includes('seed_expansion: expandedSeedPresent'));
t('regeneration preserves weekly structural context', regen.includes('previousWeeklyDiversity') && regen.includes('weekly_diversity = previousWeeklyDiversity'));
t('regeneration feeds failure constraints to writer', regen.includes('regeneration_constraints = hints.slice'));
t('rejudge receives weekly structural signatures after regeneration', regen.includes('other_post_structural_signatures'));
t('router maps structural hard failure', router.includes('return "STRUCTURAL_REPETITION"'));
t('router routes high structural repetition to style regeneration', router.includes('weekly_structural_repetition'));
console.log(`RESULT ${pass}/${pass+fail} PASS, ${fail} FAIL`);
if(fail) process.exit(1);
