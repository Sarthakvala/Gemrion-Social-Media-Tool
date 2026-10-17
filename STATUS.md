# AgencyFlow (Gemrion Social Media Tool) - status

## End goal

One internal platform where the agency runs every client brand (1-5 now) end to
end: brand kit and memory, strategy, social content, carousels and slides, reels
and video, Meta ads, SEO/AEO/GEO, client approvals, publishing, and monthly
reporting, with every AI run tracked and costed. Updated 2026-10-17 from the
original "on-brand social post studio" goal, which is now one part of it.

## Done

- **Brand Studio (2026-09-26)**, the refocus on the core idea:
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
- **Settings + providers + AI brand drafting (2026-09-26, later)**:
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
- **Phase 1 foundation (2026-10-17)**:
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
- **Share metadata + code index (2026-10-17)**: `src/lib/site.ts` (name, copy,
  URL resolution), full OG/Twitter tags in the root layout, generated 1200x630
  `/opengraph-image`, `robots.txt` + `sitemap.xml` (only /login indexable;
  console/portal noindex). Proxy now lets crawlers reach those routes.
  `npm run index:code` regenerates `docs/CODE_INDEX.md` (every top-level symbol). 93 tests.
- Earlier: Next.js 16 app, RLS schema, auth (magic link + password), console,
  client portal, OAuth + publish API + cron (kept, now secondary).

## Blocked on you

1. **Add an AI key** in the app: Settings (Anthropic and/or OpenAI), then Test connection.
2. **Test-data cleanup**: two demo IG `social_accounts` rows and the test
   client portal user still exist.
3. **Create worker/.env** from `worker/env.template`, then
   `docker compose -f worker/docker-compose.yml up -d` (image already built).

## Agency OS plan (2026-10-17)

Approved plan: `~/.claude/plans/c-users-sarthak-downloads-awesome-opus5-vast-hinton.md`. AgencyFlow becomes the
single hub for ads, SEO/AEO/GEO, content, social, creatives, video for 1-5 brands (internal tool).
Phases: Foundation (jobs + assets + approvals for any asset) -> Video/Reels -> Meta Ads -> SEO/AEO/GEO -> Reporting -> Automation.
Render/agent worker runs locally in Docker and pulls jobs from Supabase (no inbound access needed).

## In progress

- Deployed via push to `main`; verify the console after signing in (Claude
  cannot sign in to production).
- One live playbook run on Gemrion (costs a few cents on the saved OpenAI key).
- Security-hardening session (migration 005) running separately.

## Next

- Phase 2 Video/Reels: Remotion render handler in the worker (`video_render`),
  brand-templated compositions, reel pipeline, opus video prompt library as templates.
- Run a real generation once a key is saved; tune prompts on the output.
- Optional AI background images (OpenAI) behind a toggle.
- Auto-publish from the studio once the core is proven.

## Decisions

- Visuals are brand templates rendered on demand, not AI images (consistent,
  free, no storage). OpenAI kept for later optional backgrounds.
- Official vendor SDKs directly (Anthropic, OpenAI), not Vercel AI Gateway.
- AI keys live encrypted in the DB (entered in Settings); rotating the Supabase
  service role key makes saved keys unreadable, so re-enter them after a rotation.
- Website reader validates DNS on every redirect hop; a DNS-rebinding race is
  theoretically possible but the action is agency-only.
- "Training" = brand kit + few-shot examples in a cached system prompt, not fine-tuning.
- Clients may edit `platform_captions` (column grant), like caption/copy/hashtags.
- Service key server-side only, behind requireAgency().
- Worker uses the service role key (owner's choice over a scoped worker token);
  key lives only in git-ignored worker/.env, excluded from the Docker context.
- Worker is pull-based (polls `claim_job`), so production never needs to reach this PC.
- Asset files are private; viewers get 1-hour signed URLs after an access check.
- Uploads go browser -> Storage via one-time signed upload URLs; size/type are
  read back from Storage, not trusted from the browser.
- Settings default model is still `claude-opus-5`; `claude-opus-5-5` is newer and
  cheaper ($4/$20 vs $5/$25 per M tokens). Switch in Settings when convenient.
