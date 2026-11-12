# Changelog

All notable changes to AgencyFlow, newest first. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Current state and next steps live in [STATUS.md](STATUS.md).

## [Unreleased]

### Added - Native scheduler, first slice (deployed 2026-11-13; migration 009 applied, 010 pending)

- Publishing engine with per-network adapters ([ADR 0001](docs/decisions/0001-native-publishing-engine.md)).
- Channels page per brand: connect Bluesky (app password), Mastodon (any server),
  Telegram (bot) and Discord (webhook) without developer apps; many channels per network.
- Post composer: channel picker, per-channel text and first comment, live length and
  media checks, schedule at post time, next queue slot or now; per-channel status,
  live links, cancel and retry.
- Queue times, default signature and hashtag groups per brand.
- `supabase/009_publishing.sql` (channels, post_targets, claim_due_targets, posting_slots,
  hashtag_groups, signatures, mastodon_apps) and `010_publish_cron.sql` (every-minute
  pg_cron trigger); dry-run of 009 passed.

### Changed

- Post date and time are interpreted and shown in the brand's time zone (previously
  the server's UTC clock shifted them).
- Channel credentials use their own encryption key domain.

### Removed

- Old "Manual publish" button and `/api/publish` route (read the retired `social_accounts`).


### Added - Phase 2 Video & reels (deployed 2026-11-13; migration 008 applied)

- Reel render contract shared by app and worker (`src/lib/video/spec.ts`, `timing.ts`).
- `reel-scripter` playbook; script -> render spec conversion; blank template reels.
- Console > Video & reels: new reel from an idea (AI) or blank, reel list, editor
  (beats, timing, format, live brand thumbnails), render queue, render status.
- Worker `video_render`: Remotion composition (`worker/remotion/`), brand fonts from
  Google Fonts, MP4 stored as a `reel` asset with width/height/duration.
- Docker image with Chrome Headless Shell (1.48 GB); sample reel rendered natively
  and in Docker (16 s 1080x1920 in ~2.5 min on 2 cores).
- `supabase/008_reels.sql` (agency-only `reels` table), dry-run passed.

## 2026-10-17

### Added - Phase 1 foundation

- `004_jobs_assets.sql` applied (dry-run first): `jobs` (agency-only, every AI
  and worker run with tokens + cost), `claim_job()` (SKIP LOCKED, stale requeue,
  service_role only), versioned `assets` (clients may change only `approval`;
  trigger stamps approver), `asset_comments`, private `assets` bucket (500 MB).
- Cost metering: providers report usage (Observer) -> `trackJob()` records
  Studio month/brief, rewrite and brand-draft runs. Prices in `src/lib/ai/usage.ts`;
  unknown models (all OpenAI) store tokens with a null cost.
- Console: Assets library (filters, direct-to-Storage upload, versions,
  approval, notes) and Jobs page (spend this month, retry/cancel, worker test).
- Portal: Files list + review (approve / request changes, notes).
- `worker/`: Node 24 pull worker (claim, heartbeat, retry/permanent fail,
  graceful stop), Dockerfile + compose (2 CPU, 4 GB). Verified end to end on prod
  with a native run: ping job claimed, file uploaded, asset recorded, job succeeded.
- Playbook registry (`src/lib/playbooks/`): skills ported as versioned
  prompts on top of the brand system prompt, run and costed as jobs
  (`jobs.playbook = "<id>@v<n>"`, result kept in `jobs.output`). First three:
  viral-hook-writer, carousel-builder, caption-and-hashtags. Console > Playbooks
  (generated form, copy-ready result, recent runs).
- Code review follow-ups fixed: worker never requeues a job whose handler
  finished; DB writes now inside tracked jobs (no false "succeeded"); stale
  app jobs (>20 min running) swept to failed; notes load errors shown; upload
  orphan cleanup + one-child-per-version; brand check on worker test.
- `006_comment_profiles.sql` applied: fixes pre-existing bug where post notes
  never displayed (PostgREST PGRST200 on `profiles(email)`).
- Worker verified twice on prod: native run, then the Docker image
  (`worker-worker`, 339 MB) claimed and finished a ping job in ~2 s.
- `007_jobs_assets_hardening.sql` applied (dry-run first).
- Frontend for every phase: console moved to a grouped sidebar (Create /
  Publish / Grow / Library / Measure; phone menu). New sections: Video & reels
  (pipeline + video files), Meta ads (connection per brand), SEO/AEO/GEO
  (tracks + brands), Reports (live monthly table per brand). Planned sections
  show real data and plainly say what is not built yet and what they need.
- Fixed "worker last seen" (worker clears locked_at on finish; now uses finish times).
- 146 unit tests, clean build and lint (1 pre-existing lint error in platforms.ts).

### Added - Share metadata + code index

- `src/lib/site.ts` (name, copy,
URL resolution), full OG/Twitter tags in the root layout, generated 1200x630
`/opengraph-image`, `robots.txt` + `sitemap.xml` (only /login indexable;
console/portal noindex). Proxy now lets crawlers reach those routes.
`npm run index:code` regenerates `docs/CODE_INDEX.md` (every top-level symbol). 93 tests.

## 2026-09-26

### Added - Brand Studio

- The refocus on the core idea:
- `brand_profiles` + `brand_examples` tables, new post creative columns
  (`supabase/002_brand_studio.sql`, applied to prod).
- Brand kit page per brand (`/console/clients/[id]/brand`): voice, audience,
  pillars + mix, always/never, banned words, CTA, hashtags, palette, fonts,
  logo upload, example posts, live slide preview.
- Studio (`/console/studio`): generate a month with Claude (`claude-opus-5`),
  two-step (plan, then parallel writes of 3 posts) to fit Vercel time limits.
  Posts land as `draft` so cron never publishes them.
- Slide renderer `/api/render` (next/og): 6 layouts, brand fonts from Google
  Fonts, rendered on demand, nothing stored.
- Post page: preview, creative/slide editor, per-platform captions, AI rewrite
  with a note, ZIP download, "save as brand example".
- Month ZIP (slides + captions per post + calendar.csv); portal clients see
  rendered slides and can download too.
- Gemrion brand kit seeded from gemrion-marketing (navy/cream/gold, DM Sans,
  real logo URL, 6 approved captions as examples).
- Vitest added (prompt, normalize, export tests).

### Added - Settings + providers + AI brand drafting

- /console/settings: Anthropic and/or OpenAI key, provider + model, Test connection.
  Keys AES-256-GCM encrypted (HKDF from the service role key) in `ai_settings`
  (003_ai_settings.sql, applied; zero grants for anon/authenticated).
- Provider layer (Strategy): one structured-output interface, Claude via
  @anthropic-ai/sdk, OpenAI via responses.parse; falls back to the other key.
- "Draft brand kit with AI": reads a public website (SSRF-guarded fetch) + notes,
  drafts the kit using the market-brand method (voice dimensions, archetype,
  we-are/we-are-not, messaging hierarchy, pillars, palette/fonts, to-confirm list).
- Studio "From a brief" mode: campaign over any date range; month mode kept.
- Prompts rebuilt from the installed social + market-social skills: hook types,
  5 carousel frameworks, per-platform caption lengths and hashtag limits,
  pillar mix, promo spacing, 1-in-3 question posts, AI-tell avoidance.
- Old AI Gateway panel and /api/ai/generate removed; `ai` package dropped.
- 87 unit tests.

## Earlier

### Added - Foundations

- Next.js 16 app, RLS schema, auth (magic link + password), console,
  client portal, OAuth + publish API + cron (kept, now secondary).
