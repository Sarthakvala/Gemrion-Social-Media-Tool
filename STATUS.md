# AgencyFlow (Gemrion Social Media Tool) - status

## End goal

One internal platform where the agency runs every client brand (1-5 now) end to
end: brand kit and memory, strategy, social content, carousels and slides, reels
and video, Meta ads, SEO/AEO/GEO, client approvals, publishing, and monthly
reporting, with every AI run tracked and costed. Updated 2026-10-17 from the
original "on-brand social post studio" goal, which is now one part of it.

## Done

Full history: [CHANGELOG.md](CHANGELOG.md). In short: Brand Studio, AI settings and
providers (2026-09-26); Phase 1 foundation (jobs, assets, approvals, worker, playbooks,
console sections for every phase) and share metadata (2026-10-17). 146 unit tests.

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

- **Phase 2 Video & reels (2026-10-18), built, not deployed yet:**
  - Reel spec contract shared by app and worker (`src/lib/video/spec.ts`,
    `timing.ts`); reel-scripter playbook; script -> spec conversion; editor
    (beats, timing, format, live brand thumbnails); render queue button.
  - Worker: `video_render` handler + Remotion composition (`worker/remotion/`),
    brand fonts from Google Fonts, MP4 saved as a `reel` asset with size/duration.
  - Verified: native render and Docker render of the sample reel (16 s, 1080x1920,
    ~2.5 min on 2 cores, brand font loads in the container). Image now 1.48 GB.
  - Committed locally, not pushed. Waiting on: migration `008_reels.sql` (dry-run
    passed; applying it from Claude was blocked by the auto-mode safety check, so
    the owner applies it or allows it), then push/deploy, then one live reel.
- Security-hardening session (migration 005) running separately.

## Next

- Phase 2 close-out: apply 008, deploy, live reel test, worker running from `worker/.env`.
- Video prompt library (`awesome-opus5-5-videos-main.zip`) as reel templates.
- Phase 3: Meta ads (creatives, paused ads, insights sync).
- Optional AI background images (OpenAI) behind a toggle.

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
