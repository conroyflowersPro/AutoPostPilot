# AutoPostPilot v3.0.3

Specialized content management PWA for **@Seung4680**.

특화 Grok이 콘텐츠를 편집·관리하는 주체입니다.

## v3.0.3

- Schedule-safe language (startDate is metadata only; block 방금/오늘 아침 etc.)
- Korean speech default: mostly 해요체, not banmal-only
- Planner fallback uses distinct creator-domain slots
- Observation-only endings encouraged; reduce forced conclusions
- Natural post length variation + more diverse openings

## v3.0.0

- 3일 슬롯 단위 콘텐츠 캘린더 계획 (하루 5~8개 한국어 포스트)
- 날짜별 일괄 생성 (Grok 호출 ~4–5회로 감소)
- x-grok-conv-id + reasoning_effort 적용
- usedRecord로 3일 중복 방지
- localStorage 진행 상태 복구
- 수동 review 프롬프트 생성 철학과 정렬

## Features

- Login with Supabase Auth (email/password)
- Post list with status & scheduled times
- Create new posts (Korean / English track)
- Specialized Grok review (X algorithm scoring + feedback)
- Media upload from phone → Supabase Storage
- Fedica full media pipeline + scheduling (Pipeline 42303 / 20121)
- Dark mobile-friendly UI + PWA ready

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Auth + PostgreSQL + Storage + Edge Functions)
- Tailwind CSS
- xAI Grok API (grok-4.5)
- Fedica Publishing API
- Netlify hosting

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
XAI_API_KEY=...
FEDICA_API_TOKEN=...
```

## Table: SeungContent

- id, content, scheduled_at, status (draft / reviewed / scheduled / published)
- pipeline_id, fedica_post_id, media_urls, user_id, created_at, updated_at

## Deploy Edge Function

```bash
supabase functions deploy generate-post
supabase secrets set XAI_API_KEY=YOUR_REAL_KEY_HERE
```
