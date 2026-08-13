# ORDER 8C — Weekly Count + Full System QA — COMPLETE

- Version: weekly_count_full_system_qa_v1_order8c
- APP: 10.0.0-order8c-weekly-count-qa
- Engine: phased_v10_order8c_weekly_count_qa
- Branch: order8c-weekly-count-full-system-qa
- Module: supabase/functions/weekly-plan/weekly-count-ledger.ts
- Tests: tools/order8c-weekly-count-full-system-qa-test.mjs 57/57 PASS
- Regression: 8A 52/52, 8B 46/46, 8B-HOTFIX 31/31 PASS
- Netlify production: NOT deployed
- ORDER 8D: NOT started

## Acceptance
- Count ledger end-to-end
- Dynamic Planner target (no fixed 42)
- 35/42/49/56 + +1 allocation
- Slot lineage + terminal final states only
- No silent drop / 9-draft regression FAIL when collapsed
- Publishable vs slot count separation
- BLOCKED + JUDGE_UNAVAILABLE retained
- Completion gate hardened
- Remote SOT required before COMPLETE claim
