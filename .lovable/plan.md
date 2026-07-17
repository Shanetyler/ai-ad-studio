
# EASY ADs — AI Video Ad SaaS

Full QuickFrame-style clone, shipped in phases on **TanStack Start + Lovable Cloud + Stripe + Lovable AI Gateway**.

---

## High-Level Architecture

```text
┌───────────────────────────────────────────────────────────┐
│  Client (TanStack Start SSR + React 19 + Tailwind v4)     │
│  • Marketing site  • Studio  • Dashboard  • Billing       │
└─────────────┬─────────────────────────────┬───────────────┘
              │ useServerFn / loaders       │ Realtime (Supabase)
┌─────────────▼─────────────────────────────▼───────────────┐
│  Server Layer (createServerFn + /api/public/* routes)     │
│  • Auth middleware  • Credit ledger  • Job orchestrator   │
│  • Stripe webhooks  • Platform publish (Meta/TikTok/Ads)  │
└─────────────┬─────────────────────────────┬───────────────┘
              │                             │
     ┌────────▼────────┐            ┌───────▼────────────┐
     │ Lovable Cloud   │            │  AI Orchestrator   │
     │ (Supabase)      │            │  (modular adapter) │
     │ • Postgres+RLS  │            │  • Script (GPT)    │
     │ • Auth          │            │  • Image (Gemini)  │
     │ • Storage       │            │  • Video (Veo/etc) │
     │ • Realtime      │            │  • TTS/Music       │
     │ • pg_cron       │            │  • Vision/Brand    │
     └─────────────────┘            └────────────────────┘
```

**Job flow**: request → validate credits → insert `jobs` row (queued) → pg_cron worker polls → adapter runs step → updates row + emits realtime → client streams progress → final asset in Storage → credits debited on success.

---

## Database Schema (Postgres, all `public.` with RLS + GRANTs)

- `profiles` (id→auth.users, full_name, avatar_url, default_brand_id)
- `user_roles` (user_id, role enum: admin/user) + `has_role()` SECURITY DEFINER
- `brands` (id, owner_id, name, website_url, logo_url, primary_color, secondary_color, tone, tagline, guidelines_md, extracted_json)
- `brand_assets` (id, brand_id, type: logo/product/font/image, storage_path, meta)
- `projects` (id, owner_id, brand_id, title, status, thumbnail_url)
- `project_collaborators` (project_id, user_id, role)
- `scripts` (id, project_id, title, hook, beats_json, voiceover_text, duration_s)
- `storyboards` (id, project_id, scenes_json)
- `characters` / `products` / `locations` (id, brand_id, name, reference_urls[], embedding)
- `assets` (id, project_id, kind: image/video/audio/vo/music/sfx, storage_path, duration_s, meta)
- `videos` (id, project_id, master_asset_id, aspect_ratio, resolution, watermark bool)
- `jobs` (id, owner_id, project_id, kind enum, status enum, input_json, output_json, error, progress, cost_credits, model_id, created_at, started_at, finished_at)
- `credit_ledger` (id, user_id, delta, reason, job_id, stripe_event_id) — signed rows, balance = sum
- `subscriptions` (user_id, stripe_customer_id, stripe_sub_id, tier enum, seats, status, current_period_end, monthly_credit_grant)
- `credit_topups` (id, user_id, stripe_session_id, credits, amount_cents)
- `publish_targets` (id, user_id, platform: meta/tiktok/google, oauth_json)
- `publications` (id, video_id, target_id, status, external_id, url)
- `audit_log`, `usage_events` (analytics)

All user tables: `ENABLE RLS`, owner-scoped policies via `auth.uid()` or `has_role`. Every table gets explicit `GRANT` to `authenticated` + `service_role`.

---

## Server Layer

- **`src/lib/*.functions.ts`** (createServerFn + `requireSupabaseAuth`):
  - `brand.research(url)` — scrape + vision + LLM → brand JSON
  - `brand.upsert`, `brand.uploadAsset`
  - `project.create/list/get/update`
  - `script.generate(brief)`, `storyboard.generate(scriptId)`
  - `video.generate(mode, params)` — enqueues job(s)
  - `video.edit(naturalLanguage)`, `video.extend`, `video.replaceScene`
  - `credits.balance`, `credits.reserve/refund`
  - `billing.createCheckout(tier|topup)`, `billing.openPortal`
  - `publish.connect(platform)`, `publish.push(videoId, targetId)`
- **`src/routes/api/public/`** (raw HTTP, signature-verified):
  - `stripe/webhook` — subs, invoices, top-ups → credit_ledger
  - `worker/tick` — pg_cron beats this to advance queued jobs
  - `oauth/{meta|tiktok|google}/callback`
- **AI adapter** (`src/lib/ai/*.server.ts`): interface `{ script, image, video, tts, music, vision }` with concrete adapters (Lovable AI Gateway default; pluggable Runway/Veo/ElevenLabs behind env keys).

---

## Credits & Billing

- **Tiers** (Stripe Products, seeded via migration):
  - Free: 30 credits/mo, watermark, 720p, 1 seat
  - Pro $49/mo (or $470/yr): 1,500 credits, no watermark, 1080p, 3 brands
  - Business $149/mo: 5,000 credits, 5 seats, 4K, priority queue, publish integrations
  - Enterprise: custom (contact form)
- **Top-ups**: $10 / 250 cr, $40 / 1,200 cr, $150 / 5,000 cr
- **Consumption** (indicative, stored per model in `model_costs` table):
  - Script: 1 cr · Storyboard: 3 cr · Image gen: 2 cr/img · Video 5s 720p: 25 cr · 1080p: 50 cr · TTS: 1 cr/100 chars
- Flow: reserve on job insert, refund on failure, commit on success.

---

## UI / Page Flows

Marketing (public routes):
- `/` hero + reel · `/features` · `/pricing` · `/examples` · `/enterprise` · `/blog` · `/auth`

App (`/_authenticated/*`):
- `/dashboard` — projects grid, credits, recent renders
- `/brands` + `/brands/$id` — brand builder (URL research, uploads, guidelines)
- `/studio/new` — mode picker (Prompt · Image · URL · Extend · Elements · Style Gallery)
- `/studio/$projectId` — 3-panel: left scenes/timeline, center preview, right controls (shots, lighting, mood, pacing, dialogue, AI edit chat)
- `/library` — assets/characters/products/locations
- `/publish/$videoId` — platform pickers
- `/billing` — plan, usage graph, invoices, portal
- `/settings` — team, API keys, brand defaults
- `/admin` (role-gated) — jobs monitor, cost analytics

Design system: cinematic dark theme (deep charcoal, warm accent, film-grain hero video), semantic oklch tokens in `src/styles.css` (no hardcoded colors), shadcn variants for `hero`/`cinematic`/`premium` buttons.

---

## Phased Delivery

**Phase 1 — Foundation (this turn's build target)**
1. Enable Lovable Cloud + email/Google auth
2. Design system + landing page + pricing page + auth page
3. Schema: profiles, user_roles, brands, brand_assets, projects, jobs, credit_ledger, subscriptions
4. Brand builder (URL → research via Lovable AI + fetch) with logo upload
5. `/studio/new` prompt-to-storyboard + AI script generation (text pipeline working end-to-end, video step stubbed to image storyboard)
6. Dashboard + credits display + free tier auto-grant on signup

**Phase 2 — Video pipeline**
- Enable Stripe Payments, seed tiers, webhook → ledger
- Image-to-video + prompt-to-video via adapter (starts on Lovable AI image gen, video adapter interface with mocked renderer until you plug Veo/Runway keys)
- pg_cron worker + realtime progress
- Timeline editor + scene regenerate

**Phase 3 — Advanced**
- Voiceover (TTS), music/SFX, characters/products consistency
- Natural-language edit assistant, extend, replace scene, compliance checks
- Meta / TikTok / Google Ads publish (OAuth + upload)
- Team seats, collaboration, admin analytics

---

## Technical Details

- **AI defaults**: `openai/gpt-5.5` (script, brand research, edit assistant), `google/gemini-3-pro-image` (storyboard frames, style transfer), video/TTS behind adapter (mock in Phase 1, plug real models when keys added via `add_secret`).
- **Jobs**: single `jobs` table, states `queued|running|succeeded|failed|canceled`, `kind` enum drives adapter dispatch. pg_cron every minute hits `/api/public/worker/tick` with HMAC-signed body.
- **Storage buckets**: `brand-assets` (private), `project-assets` (private), `renders` (private, signed URLs), `public-showcase` (public).
- **Security**: RLS everywhere, roles in `user_roles` only, webhook signature verification, rate-limit reservations via credit ledger, input validation with zod on every server fn.
- **SEO**: per-route `head()` metadata, sitemap.xml, robots.txt, JSON-LD on landing.
- **Deployment**: Lovable-managed (Cloudflare Workers runtime for server layer, Supabase for data). No Vercel needed — publish via Lovable's built-in Publish.

---

## What I'll build first (Phase 1) if you approve

1. Enable Lovable Cloud
2. Design system + landing (hero, features, pricing, footer) + auth + `/pricing`
3. Migrations for `profiles`, `user_roles`, `brands`, `brand_assets`, `projects`, `jobs`, `credit_ledger`, `subscriptions` + auto-grant trigger (30 free credits on signup)
4. `/dashboard`, `/brands`, `/brands/new` (URL research working), `/studio/new` (prompt → AI-generated script + storyboard frames stored as assets)
5. Google + email auth, protected `_authenticated` subtree, credits pill in header

Approve to proceed, or tell me to reshape scope (e.g. "skip marketing, start in the studio" or "Phase 1 + Stripe now").
