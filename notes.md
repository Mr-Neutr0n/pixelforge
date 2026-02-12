# PixelForge — Notes

## Status

Almost done. Only Supabase DB + gallery remaining.

## Done

- Refined the app
- Added rate limits
- Rewrote GitHub README (de-AI'd)
- Made it responsive
- Adventure Navy theme redesign (Endesga 32 palette, Silkscreen + Press Start 2P fonts)
- Added logo (anvil+hammer), favicon (multi-size .ico), OG banner (1200x630)
- Full social meta: OpenGraph + Twitter Card
- Mobile touch controls for sandbox: on-screen D-pad + jump/attack buttons
- Fixed metadataBase domain for WhatsApp/social link previews

## To Do

- [ ] Add Supabase DB + public sprite gallery

## Supabase Plan

**Stack:** Supabase (PostgreSQL + Storage) — one service for both DB and files.

**Supabase setup:**
- Create `sprites` table: `id (uuid)`, `prompt (text)`, `character_image_url (text)`, `sprite_sheets (jsonb: {walk, jump, attack, idle} URLs)`, `created_at (timestamp)`, `likes (int default 0)`
- Create `sprites` storage bucket (public read, service-key write)

**Backend changes (Railway):**
- Add `@supabase/supabase-js`
- After Gemini generates a sprite: decode base64 → upload PNG to Supabase Storage → get public URL → insert row into DB
- Add `GET /api/gallery` endpoint (paginated, sorted by newest)
- Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

**Frontend changes (Vercel):**
- Add `@supabase/supabase-js`
- Add `/gallery` page: fetch from Supabase directly (public reads, no backend hop needed)
- Render grid of sprite cards with images from Supabase Storage URLs
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Why Supabase over alternatives:**
- Railway Postgres = no image storage (need separate S3/R2)
- Vercel Blob + Vercel Postgres = two separate services
- Supabase = DB + Storage + optional Auth in one dashboard, one JS client

**Free tier limits:** 500MB DB, 1GB storage (~1,000-2,000 sprites)
