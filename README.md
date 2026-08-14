# AutoPostPilot v11.0.0

Specialized Growth OS for **@Seung4680**.

Version source of truth: `package.json` / `lib/version.ts` (`11.0.0`).

**Product direction:** [architecture/v11.0.0_PRODUCT_DIRECTION.md](architecture/v11.0.0_PRODUCT_DIRECTION.md)

One line: Sync snapshots old and new posts; Grok fetches via API; files only if unknown (named ask + remind until 무시). Chat screenshots need a final `반영해` — `진행` does not apply.

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
