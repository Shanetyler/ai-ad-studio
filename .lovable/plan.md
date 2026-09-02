# Easy Ad — Deep Business Intelligence + Character Studio

Two upgrades on top of what already works. Nothing existing gets rebuilt: the URL research, brand kits, ad wizard, browser renderer, auth and saved projects all keep working exactly as they do today.

## Upgrade 1 — Deep website business intelligence

Today `researchBrand` fetches one page, strips tags, asks the AI for a small brand profile, and inserts a `brands` row. That stays as the "Quick scan" path. On top of it we add a "Deep scan":

1. Fetch the URL, follow same-origin links (plus `/sitemap.xml` when present) and pick up to ~10 relevant pages by URL/anchor scoring: home, about, services/products, pricing, contact, testimonials/reviews, FAQ, locations.
2. Extract per page: cleaned text, title/meta, JSON-LD (`LocalBusiness`, `Product`, `FAQPage`, `Review`), phones/emails/addresses, social links, logo and hero/product image candidates.
3. One consolidating AI pass turns the corpus into a structured business profile: offerings, offers/pricing, locations/service area, USPs, testimonials, FAQs, brand voice/language, audience, plus a creative brief (angles, hooks, objections, proof points).
4. Every field carries provenance — `source_url` + `confidence` when scraped, or flagged `ai_suggested` when inferred. A review screen shows the two visually distinct and lets the owner edit/confirm before production. Only a confirmed profile is treated as facts.
5. Discovered brand assets (logo, hero images) are listed with their remote URLs; the owner can import chosen ones into `project-assets` storage for use in ads.

Scan work runs as a `jobs` row so progress is visible and failures refund credits like the existing plan/render flow.

## Upgrade 2 — Real reusable character studio

`cast_members` today is name/description/attributes/reference_url/rights_confirmed. It gets extended (not replaced) into a production asset:

- Multiple reference images per character stored in `project-assets` (private, owner-scoped), with one primary frame used for image-to-video consistency.
- Structured appearance metadata (age range, wardrobe, setting, distinguishing features) plus a generated, reusable "appearance prompt block" that is injected verbatim into every generation so the same character looks consistent across ads.
- Voice config: style/pace/accent description, optional provider + provider voice id, and a persisted generation seed.
- Rights/consent record: who confirmed, when, and scope. Provider cloning features stay hidden unless the configured provider actually supports them and consent is on file. The UI keeps saying likeness/voice cloning is not available otherwise.
- Characters are owner-scoped and business-agnostic, so one character is reusable across brands and ads.
- Selecting a character in the wizard now actually feeds the pipeline: appearance block + primary reference image go into the spokesperson shots, voice config into voiceover, and the character id is recorded on the project.

## Creative director / production pipeline

A director step sits between the brief and the shot list. For each beat it chooses the cheapest sufficient shot type:

```text
business media / imported photos   -> free
motion graphics + typography       -> free (browser renderer)
AI still image                     -> cheap
AI spokesperson video              -> expensive, only for talking beats
```

Rules: at most one or two AI video shots per ad, spokesperson video only when a character is selected and the beat is a talking beat, everything else assembled by the existing browser renderer. The renderer stays the assembly and fallback layer — if any AI shot fails, the beat degrades to a graphics/photo shot instead of failing the ad.

## Technical detail

### Files to modify
- `src/lib/brand.functions.ts` — keep `researchBrand` (quick), add `deepScanWebsite`, `getBusinessProfile`, `confirmBusinessProfile`, `importBrandAsset`.
- New `src/lib/research/crawl.server.ts` (fetch/discover/extract, same-origin, capped pages, timeouts) and `src/lib/research/profile.server.ts` (AI consolidation + provenance types).
- New `src/lib/business-profile.ts` — client-safe types for profile, provenance, creative brief.
- `src/lib/library.functions.ts` — extend `CastSchema` and CRUD for reference images, appearance metadata, voice config, provider ids, generation settings, consent fields.
- New `src/lib/director.server.ts` — brief + profile + character -> shot list with `shot_type` per beat and a cost estimate.
- `src/lib/providers/types.ts` + `index.server.ts` — `generateAdScript` accepts a business profile and character; add `characterRef` to `VideoProvider.generateScene`; keep mock fallbacks.
- `src/lib/ads.functions.ts` — plan generation reads a confirmed profile when `brandId`/`profileId` given; persist `shot_list`/character id; credit accounting unchanged in total.
- `src/lib/ad-types.ts` — add `shot_type` to `AdScene`, add character/voice refs to `AdPlan`.
- `src/routes/_authenticated/brands.tsx` — quick vs deep scan, progress, review/confirm screen with facts vs AI suggestions.
- `src/routes/_authenticated/cast.tsx` — full character studio editor (reference image upload, appearance fields, voice config, consent).
- `src/routes/_authenticated/create.tsx` — pick a confirmed business profile; character selection wired through to the plan.
- `src/lib/render/ad-renderer.ts` — honor `shot_type` (video clip vs image vs graphics beat); existing behaviour preserved as the default.

### Migrations
- `business_profiles` — owner_id, brand_id, website_url, status (`scanning`/`ready`/`confirmed`), profile_json, brief_json, provenance_json, confirmed_at. Owner-scoped RLS + GRANTs to `authenticated`/`service_role`.
- `business_pages` — owner_id, profile_id, url, page_type, title, extracted_json, fetched_at. Same policies.
- `cast_members` — add `appearance_json`, `voice_json`, `generation_json`, `reference_images` (jsonb array), `voice_provider`, `voice_provider_ref`, `consent_by`, `consent_at`, `consent_scope`. Additive with defaults so existing rows (including Shane) keep working.
- `projects` — add `business_profile_id`, `character_id`, `shot_list_json`.
- No changes to storage buckets; reference images live in the existing private `project-assets` bucket under `<uid>/characters/`.

### Providers and credits
- All AI text/image/video keeps going through the Lovable AI Gateway helpers already in `ai-gateway.server.ts`; Fal stays opt-in behind `FAL_ENABLED`. ElevenLabs voice stays optional and hidden when unconfigured.
- Credits: quick scan free (as today), deep scan 2 credits (refunded on failure), plan 2, render 8 — a standard ad stays at 10 total. AI spokesperson shots are metered separately and only charged when a real video provider is configured; in demo mode the director returns free graphics shots.
- Crawl safety: same-origin only, robots-respecting, 10-page and byte caps, 8s per-request timeout, no private-network hosts.

### Implementation order
1. Migrations (profiles/pages tables, additive cast + project columns).
2. Crawler + profile extraction with provenance; deep-scan server functions and job wiring.
3. Brand scan UI: quick/deep, progress, review-and-confirm.
4. Character studio schema plumbing + editor UI + reference image upload.
5. Director module and shot-list generation; plan generation consumes profile + character.
6. Renderer honors shot types; character reference flows to spokesperson shots.
7. QA pass: existing ads still open and play, quick scan unchanged, deep scan -> confirm -> ad -> export end to end.
