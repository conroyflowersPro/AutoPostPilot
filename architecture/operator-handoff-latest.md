# Operator thread handoff — 2026-08-17

새 채팅/에이전트는 **이 파일을 먼저** 읽고 이어서 작업한다. Writer·Planner·Judge 프롬프트에 넣지 않는다.

## Who / how

- Operator: Seung (@Seung4680). Talk in **Korean** 존댓말. Lead with the answer.
- Primary client: iPhone Safari.
- Do **not** merge/deploy to `main` until Seung says **배포해**.
- DNA/engine/design changes only after **반영해** / **넣어** / **이대로**.
- Intent protocol: `architecture/GROK_DEVELOPMENT_INTENT_PROTOCOL.md` · contract: `AGENTS.md`.
- Repo: `github.com/conroyflowersPro/AutoPostPilot`
- Production: `https://autopostpilot.netlify.app` (Netlify on push to `main`; Edge on `main`)
- KR Fedica pipeline default: `42303`

## Shipped on main now

**v12.5.5** (`2b204ca`). Header should show `v12.5.5`.

| Version | What |
| --- | --- |
| 12.5.3 | Fedica `Success: true` → AP `scheduled` even without content `Id` |
| 12.5.4 | Retry batch **resumes after already-booked** `scheduled_at` (do not reuse 14:00). iPhone date picker `stopPropagation`. Stale `scheduling` (>15 min) → `reviewed` |
| 12.5.5 | Gaps are **X Home/For You author diversity (~2 hours)**. Do **not** compress to 45 min to fill an afternoon. **14:00–22:00 PT = audience posting hours**, not an AP “For You window” |

PR that shipped this: https://github.com/conroyflowersPro/AutoPostPilot/pull/75

Previous cloud thread: https://cursor.com/agents/bc-b638d1be-e9d1-4fde-bd13-9cf0b728a485

## What Seung hit (do not re-diagnose from scratch)

1. First run: **3 posts, ~2h gaps — correct.**
2. Interrupted, retry **15 posts**. AP always rebuilt slots from **that day’s 14:00 PT**, overlapping the first 3.
3. Fedica already had those times → dropped DateTime → dumped all at **pipeline now (17 Aug ~8:29)**.
4. Date picker felt broken: same-day 14:00 conflict + iPhone `<details>` swallowing the date control.
5. Seung corrected: “For You” meant **X’s algorithm**, not AP’s 14:00–22:00 packing window.

Resume example: occupied 14/16/18 PT → next **20:00 → 22:00 → next day 14:00**. Never 20/21/22.

## Operator cleanup (code does not undo Fedica)

If 8:29 dumps still exist:

1. Delete those in **Fedica**. Keep the first 3 that were spaced correctly.
2. Delete matching rows in AP queue **scheduled**.
3. Reschedule remaining **reviewed** after deploy — continues after the kept 3 at ~2h.

## Key files

- `lib/schedule.ts` — `nextForYouSlotAfterOccupied`, `buildDaySpreadSlots` (step +2h)
- `app/api/fedica/batch-schedule/route.ts` — occupied resume, unstick `scheduling`
- `app/api/fedica/schedule/route.ts` — single-post same resume
- `app/components/PostList.tsx` — date picker, copy
- `supabase/functions/weekly-plan/for-you-spread.ts` — planner stamp +2h (Edge lockstep)
- Tests: `npm test` (`tests/schedule-resume-occupied.test.ts`, `tests/lockstep-version.test.mjs`)
- Version lockstep: `package.json` = `lib/version.ts` = weekly-plan `APP_VERSION`

## Must not change without Seung

- Do not rename/compress gaps into an AP “For You window”.
- Do not merge to `main` without **배포해**.
- Do not put this handoff into post engines.

## Stated, not shipped — Creator DNA absorbs Planner (2026-08-17)

Do **not** implement until Seung says **반영해** / **넣어** / **이대로**. Do not paste this into Writer/Judge prompts as if it were live.

**Seed Generator:** candidates only. Does not choose, does not assign roles, does not instruct Writer.

**Creator DNA does all of:**
1. Review candidate seeds (account 결 / 알맹이 / 확장 가능성)
2. Choose which seeds live
3. Return / Bridge / Reach on kept seeds
4. Select learned theory
5. Generate 말투 + structure **Writer instructions**
6. Assign and schedule the seven days, plus the batch work attached to that schedule

**Data for seed choice:** 30-day X Analytics. Last-14-day X sync fills holes in that 30-day window. Analytics is primary; sync is the patch, not a second strategy.

**Theories:** `reaction-mechanisms.ts` (M1–M9, viral-post analysis) is **not** the theory layer. DNA learns theories and uses them as **cards**. Which card “works” for this account is unknown — do **not** rank cards by likes/follows. 30d/14d data is to (1) use card **diversity**, (2) pick a card that **fits the seed**, (3) block **frequent repeating patterns**. Complexity/emergence: do not locally optimize a winning card; the week’s quality emerges from varied fit, not from cloning what converted.

**Writer:** writes body only, following DNA instructions. Does not choose seed, role, theory, or schedule.

**Planner:** role absorbed by DNA. No separate Planner strategy/placement job after this ships.

**Not a chat Agent.** Goal in → judge → tools if needed → artifacts out. One work loop, not a conversation with Seung.

Current code is still the old split (DNA types → Planner place Seeds → Writer owns form). This contract replaces that split when implemented.

## Open

Confirm whether Fedica 8:29 posts and AP scheduled leftovers were cleaned, then whether remaining reviewed were rescheduled after 12.5.5. Creator DNA absorb-Planner is specified, waiting on **반영해**.
