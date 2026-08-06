# AutoPostPilot v2.2.0

Specialized content management PWA for **@Seung4680**.

특화 Grok이 콘텐츠를 편집·관리하는 주체입니다.

## v2.2.0

- 사용자가 날짜를 선택하면 3일치 한국어 포스트를 특화 Grok이 생성
- X 알고리즘 기반 점수 + 미디어 제안
- 폰으로 촬영한 이미지/영상을 업로드하면 해당 포스트에 첨부
- Fedica API로 최소 3.5시간 간격 자동 스케줄링
- 날짜 현황으로 중복 방지
- 특화 Grok = 콘텐츠 편집·관리 주체

## Features (current)

- Login with Supabase Auth (email/password)
- Post list with status & scheduled times
- Create new posts (Korean / English track)
- **Specialized Grok review** (X algorithm scoring + feedback + media suggestion)
- Media upload from phone (camera supported) → Supabase Storage
- **Fedica full media pipeline** (init → upload → finalize → MediaId)
- Fedica scheduling (Pipeline 42303 / 20121)
- Dark mobile-friendly UI + PWA ready

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Auth + PostgreSQL + Storage + Edge Functions)
- Tailwind CSS
- xAI Grok API
- Fedica Publishing API
- Netlify hosting (UI only)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
XAI_API_KEY=...   # Netlify env + Supabase secrets
FEDICA_API_TOKEN=...
```

## Table: SeungContent

- id, content, scheduled_at, status (draft / reviewed / scheduled / published)
- pipeline_id, fedica_post_id, media_urls, user_id, created_at, updated_at

## v2.2.0 — Generation on Supabase Edge Function

- Post generation runs on **Supabase Edge Function** (`generate-post`)
- **1 post per API call** (stable with long system prompt)
- Netlify hosts UI only — no more 26s generation timeout

### Deploy the Edge Function

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy generate-post
supabase secrets set XAI_API_KEY=YOUR_REAL_KEY_HERE
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically.
Do not hardcode any API keys in the repo.
