# AutoPostPilot v11.0.0

Specialized Growth OS for **@Seung4680**.

Version source of truth: `package.json` / `lib/version.ts` (`11.0.0`).

**Product direction:** [architecture/v11.0.0_PRODUCT_DIRECTION.md](architecture/v11.0.0_PRODUCT_DIRECTION.md)

One line: Infer from data, never examples. No falsehood vs experience. Assist posting and scheduling after review + original media.

Reply suggest / polish is **out of the v11 product surface** (frozen).

## Auth (operational)

- `GET /auth/callback` — exchanges Supabase PKCE `code` for session (reset / confirm)
- `/auth/update-password` — set new password after recovery link
- Login: **비밀번호를 잊으셨나요?** → `resetPasswordForEmail` with redirect to callback

### Supabase Dashboard

Authentication → URL Configuration

- **Site URL**: `https://YOUR_DEPLOYED_DOMAIN`
- **Redirect URLs**:
  - `https://YOUR_DEPLOYED_DOMAIN/auth/callback`
  - `https://YOUR_DEPLOYED_DOMAIN/auth/update-password`
