# AutoPostPilot v7.3.2 RELEASE

**Deploy stamp:** `2026-08-09-v7.3.2-no-silent-fallback`

## Critical fix
- Planner timeout / failure → **no** hard-coded FSD/Cybertruck/Robotaxi fallback
- Generate stops on plan failure → **does not** create 35 draft posts
- Server returns 503 + empty days on plan failure

## Included from 7.3.0–7.3.1
- Audience snapshot / movement / confidence modules
- Performance candidate lifecycle modules
- POST `/api/learning/batch`
- Creator / Performance DNA runtime connection for planner

## Verify after deploy
1. Open `/generate`
2. Page helper text: Planner 실패 시 자동 대체 초안을 만들지 않습니다
3. Force-fail plan (or wait timeout) → **red error only**, no 35 drafts
4. Clear localStorage keys starting with `autopostpilot_generation_job_` if old jobs linger
