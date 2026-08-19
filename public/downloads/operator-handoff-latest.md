# Operator thread handoff — 2026-08-19

새 채팅/에이전트는 **이 파일을 먼저** 읽고 이어서 작업한다. Writer·Planner·Judge 프롬프트에 넣지 않는다.

## Current (do not treat older sections as live version)

- **this branch:** **v12.12.21** public seed directions. 공개 추출은 한 번의 raw 0으로 닫지 않음. Seed는 방향이고 Agent승이 씀. 원문 문장·`실사용 후속` 라벨은 저장하지 않음. compact/targeted에도 x_search 유지. 공식 글이 있으면 Grok `[]`여도 코드가 방향 Seed를 만듦. v12.12.20 EXPERIENCE grounding은 유지.
- **main / live:** **v12.12.20** (`19eb4d2`). EXPERIENCE grounding. 헤더 `v12.12.20`.
- **배포:** 하지 않음. 운영자가 **배포해**라고 할 때까지 `main`에 넣지 않는다. 이 브랜치는 draft PR만.
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

**v12.12.20** (`19eb4d2`). Header should show `v12.12.20`.

| Version | What |
| --- | --- |
| 12.12.16 | 공개 창 끝 뒤 재검색 없음 |
| 12.12.17 | EXPERIENCE stale pick 거절 |
| 12.12.18 | must_fill. unused lived 없으면 Mode 변경 — **12.12.20이 닫음** |
| 12.12.19 | 공개 X 탐색량에서 lived 제외. 동적 예산. `칸+10` 삭제 |
| 12.12.20 | EXPERIENCE grounding. 수제글 원문은 Seed가 아님 |

## This branch (v12.12.21)

의도:

1. 공개 Seed 추출이 실제로 돌아가 쓸 수 있는 방향 Seed를 더 만든다
2. Seed는 트윗 문장이 아니라 방향이다. Agent승이 추론하고 쓴다
3. 공식/공개 글은 장면이 돌고 있다는 증거다. 원문을 `concrete_subject`에 넣지 않는다
4. `실사용 후속` / 관찰 축 / 칸 타입 라벨은 거절한다
5. raw 0 한 번으로 7일 공개 창을 닫지 않는다. 다른 검색어/구간으로 1–2번 더 찾는다
6. Mode·Collection 1회/칸·lived GROUNDING_EVIDENCE는 바꾸지 않는다

핵심 파일:

- `supabase/functions/weekly-plan/creator-seed-reasoning.ts`
- `supabase/functions/weekly-plan/public-x-seed-search.ts`
- `supabase/functions/weekly-plan/generation-job.ts`
- `supabase/functions/weekly-plan/seed-scope.ts`
- `tests/public-seed-extraction-direction.test.ts`

v12.12.20 EXPERIENCE grounding과 공개 예산 파일은 유지한다.

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
