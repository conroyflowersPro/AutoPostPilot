# AutoPostPilot v5.5.3

Specialized content management PWA for **@Seung4680**.

## v5.5.3 — Auth password-reset callback

- `GET /auth/callback` — exchanges Supabase PKCE `code` for session (reset / confirm)
- `/auth/update-password` — set new password after recovery link
- Login: **비밀번호를 잊으셨나요?** → `resetPasswordForEmail` with redirect to callback

### Supabase Dashboard 설정 (필수)
Authentication → URL Configuration
- **Site URL**: `https://YOUR_DEPLOYED_DOMAIN`
- **Redirect URLs**에 추가:
  - `https://YOUR_DEPLOYED_DOMAIN/auth/callback`
  - `https://YOUR_DEPLOYED_DOMAIN/auth/update-password`

## v5.5.2
- Priority 1: Analytics Coverage / Deduplication API + import dedup

## v5.5.1 / v5.5.0
- Quality Engagement Evaluation Layer, X Algorithm Intelligence, Reply Strategy
