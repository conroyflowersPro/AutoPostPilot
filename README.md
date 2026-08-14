# AutoPostPilot v11.0.0

Specialized Growth OS for **@Seung4680**.

Version source of truth: `package.json` / `lib/version.ts` (`11.0.0`).

**Product direction:** [architecture/v11.0.0_PRODUCT_DIRECTION.md](architecture/v11.0.0_PRODUCT_DIRECTION.md)

One line: 7-day generate writes as `@Seung4680`; after review + original media, AI auto-publishes via Fedica and decides gaps. Handmade vs AP stay separate. No 30-day collisions except 2–3 experiments.

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
