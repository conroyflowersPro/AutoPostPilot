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

## Stated, not shipped — Agent승 absorbs Planner (2026-08-17)

Do **not** treat the full absorb as live until Seung says **반영해** / **넣어** / **이대로**. Name + operating structure are planted in the DNA block; RAG search is coded but not yet on the write path.

**Name:** Creator DNA → **Agent승**. 채팅창이 아니라 주를 운영하는 작업자.

**Seed Generator:** candidates only.

**Agent승 operating structure (always in the model, not RAG):**
choose seeds (결 / 알맹이 / 확장) · RETURN|BRIDGE|REACH · writing theory · Writer 말투/structure instructions · seven-day schedule + batches.

**Writing theories:** xAI **Collections API** (`POST /v1/documents/search`, hybrid). Server-side search only — do **not** give Grok `collections_search` as a tool (multi-search cost). `limit` 3 chunks. Reinterpret; mix at most 2 cards. Env `XAI_THEORY_COLLECTION_ID`. Skip if unset.

**Cost:** operating structure is prompt (cheap, every call). Theory library is retrieved only when emitting Writer instructions. Judge does not search. One query per slot, not a tool loop.

**Data:** 30-day Analytics + 14-day sync fills holes. Not a conversion ranking. Diversity, seed-fit, anti-repeat.

**Writer:** body only from Agent승 instructions.

**Planner:** absorbed (not fully wired yet).

## Open

Confirm whether Fedica 8:29 posts and AP scheduled leftovers were cleaned, then whether remaining reviewed were rescheduled after 12.5.5. Creator DNA absorb-Planner is specified, waiting on **반영해**.
