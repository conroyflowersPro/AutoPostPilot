# AutoPostPilot

Specialized content management PWA for **@Seung4680**.

## Features (MVP)

- Login with Supabase Auth (email/password)
- Post list with status & scheduled times
- Create new posts (Korean / English track)
- **Specialized Grok review** based on X algorithm scoring
- Media upload from phone (camera supported)
- Fedica scheduling (Pipeline 42303 / 20121)
- Dark mobile-friendly UI + PWA ready

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Auth + PostgreSQL + Storage)
- Tailwind CSS
- xAI Grok API
- Fedica Publishing API
- Netlify hosting

## Quick Setup

### 1. Environment Variables

Copy `.env.example` → `.env.local` (local) and also set them in **Netlify → Site settings → Environment variables**:

```
NEXT_PUBLIC_SUPABASE_URL=https://ihhiyecifxrqxfpyylpt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
XAI_API_KEY=xai-...
FEDICA_API_TOKEN=27838071_...
```

### 2. Supabase Storage Policy (important)

In Supabase Dashboard → Storage → `media` bucket → Policies:

Allow public read + authenticated upload:

```sql
-- Public read
create policy "Public read access"
on storage.objects for select
using ( bucket_id = 'media' );

-- Authenticated upload
create policy "Authenticated upload"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'media' );

-- Authenticated update/delete own files (optional)
create policy "Authenticated update"
on storage.objects for update
to authenticated
using ( bucket_id = 'media' );
```

### 3. Local Development

```bash
npm install
npm run dev
```

### 4. Deploy to Netlify

1. Connect the GitHub repo `conroyflowersPro/AutoPostPilot`
2. Build command: `npm run build`
3. Publish directory: leave default (plugin handles it)
4. Add the environment variables above
5. Deploy

## Table Schema (already created)

`SeungContent`:
- id (uuid)
- content (text)
- scheduled_at (timestamptz)
- status (text: draft / reviewed / scheduled / published)
- pipeline_id (text)
- fedica_post_id (text)
- media_urls (text[])
- created_at, updated_at
- user_id (uuid)

## Next Steps (after MVP)

- Full Fedica media upload pipeline (init → upload → finalize)
- xAI image editing integration
- Better scheduling UI (pick exact time)
- Chat interface with specialized Grok
