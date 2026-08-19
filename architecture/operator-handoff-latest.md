# Operator thread handoff — 2026-08-19

새 채팅/에이전트는 **이 파일을 먼저** 읽고 이어서 작업한다. Writer·Planner·Judge 프롬프트에 넣지 않는다.

## Current (do not treat older sections as live version)

- **main / live:** **v12.12.19** (`6171ebe`). 공개 X 탐색 예산은 lived와 분리. `칸+10` 없음. 헤더 `v12.12.19`.
- **이어서 할 일:** EXPERIENCE grounding. 경험 Evidence 개수 ≠ EXPERIENCE 글 개수. 수제글 원문은 Seed가 아님. EXPERIENCE 칸만 lived 사실. 부족하면 코드가 Mode를 바꾸지 않고 Agent승이 그 Slot만 재추론.
- 그 작업은 한때 `e8c596e`로 올렸다가 Seung이 **배포 중단** → `f3019e9` revert. **현재 main에는 없음.** 다시 올리면 **v12.12.20**. 공개 탐색 예산은 유지한 채 얹는다. 옛 브랜치 `cursor/experience-grounding-not-quota-c02a` / PR #86은 revert 이전 코드.
- 공개 탐색 PR: https://github.com/conroyflowersPro/AutoPostPilot/pull/87
- **ORDER 1 (v12.9.0):** 7일 Evidence · Slot 날짜/시각.
- **ORDER 2 (v12.10.0):** Agent승 Thinking Intelligence · Core Thought · 직접 WRITE.
- **ORDER 3 (v12.11.0):** Independent Judge · Slot-only REPAIR · 기존 Calendar · 기존 Fedica가 Agent승 `planned_at`을 실행.
- **HOTFIX (v12.11.2):** USER_DIRECT 확정 경로 · repair/replan 카운터 분리 · Thinking 합성 cursor · Fedica BPT timing 입력.
- **ORDER Collection (v12.12.0):** THINK → Core Thought → Collection 1회 → WRITE. 후보 2+2. Agent승이 0~N 선택.

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

**v12.12.19** (`6171ebe`). Header should show `v12.12.19`.

| Version | What |
| --- | --- |
| 12.12.16 | 공개 창 끝 뒤 재검색 없음 |
| 12.12.17 | EXPERIENCE stale pick 거절 |
| 12.12.18 | must_fill. unused lived 없으면 Mode 변경 — **다음 EXPERIENCE grounding이 닫을 대상** |
| 12.12.19 | 공개 X 탐색량에서 lived 제외. 동적 예산. `칸+10` 삭제 |

## Next (EXPERIENCE grounding — not on main)

의도:

1. Agent승 PLAN이 주간 전체를 보고 EXPERIENCE가 몇 칸인지 추론
2. `lived_scene_count` / expSupply는 공급량이지 EXPERIENCE 할당량이 아님
3. 수제글 문장을 Seed로 재활용하지 않음. EXPERIENCE 칸에만 사실 grounding
4. 그 칸 lived가 부족하면 코드가 Mode를 바꾸지 않고 Agent승이 그 Slot만 재추론

이미 있는 구현: `e8c596e`. 현재 main의 공개 예산과 충돌하지 않게 rebase한 뒤 12.12.20으로 올린다. 다시 처음부터 진단하지 말 것.

핵심 파일 (그때 만진 것):

- `supabase/functions/weekly-plan/creator-week-slots.ts` · `engine-dna.ts` · `audience-x-status.ts`
- `supabase/functions/weekly-plan/analytics-lived-seeds.ts` · `seed-ownership.ts` · `seed-engine.ts`
- `supabase/functions/weekly-plan/seven-day-planner.ts` · `generation-job.ts`
- `tests/experience-grounding-not-quota.test.ts` (revert로 main에서 삭제됨)

공개 예산 파일은 유지: `public-exploration-budget.ts`

## Must not change without Seung

- Do not merge to `main` without **배포해**.
- Do not put this handoff into post engines.
- Do not invent EXPERIENCE% in code.
- Collection API still 1 search per slot.
- Do not commit `package-lock.json`.

## Stated, not shipped — Agent승 absorbs Planner (2026-08-17)

Do **not** treat the full absorb as live until Seung says **반영해** / **넣어** / **이대로**. Name + operating structure are planted. Planner absorb not fully wired.

## Older (not the live problem)

2026-08-17 Fedica 8:29 dump / 14:00 resume. Gaps are X author diversity (~2h), not an AP For You window. See older changelog. Do not re-diagnose unless Seung brings it back.
