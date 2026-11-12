# AgencyFlow (Gemrion Social Media Tool) - status

## End goal

One internal platform where the agency runs every client brand (1-5 now) end to
end: brand kit and memory, strategy, social content, carousels and slides, reels
and video, a native scheduler with the feature set of Postiz/Mixpost/TryPost for
staff and AI agents, Meta ads, a website builder with recurring SEO/AEO/GEO, client
approvals and monthly reporting, with every AI run tracked and costed.
(Updated 2026-11-13: scheduler parity and the website module added.)

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

- **Phase 2 Video & reels:** built and committed locally (`b3e5844`), not pushed.
- **Module 1 native scheduler (2026-11-13), first slice built, not pushed:**
  - Design: [ADR 0001](docs/decisions/0001-native-publishing-engine.md). Feature
    inventory of the three apps: [docs/research](docs/research/2026-11-13-scheduler-feature-inventory.md).
  - Channels per brand (many per network, encrypted credentials), per-channel post
    targets, approval-gated claim, queue times, signatures, hashtag groups.
  - Adapters that need no developer app: Bluesky, Mastodon (auto app registration +
    OAuth), Telegram (bot), Discord (webhook). OAuth networks listed with the env
    vars that will switch them on.
  - Composer on the post page: channel picker, per-channel text and first comment,
    live limits, schedule at post time / next queue slot / now, status with links,
    cancel and retry. Old publish button and route removed.
  - Fixed: post date/time now saved and shown in the brand time zone (was server UTC).
- **Blocked:** migrations 008, 009, 010 must be applied before pushing (the new
  pages read those tables). Applying from Claude is blocked by the auto-mode check.

## Next

- Apply 008/009/010 (+ Vault secrets for 010), push, deploy, connect a Bluesky
  channel and publish one post end to end.
- Scheduler parity backlog (from the inventory): agent API + MCP server, OAuth
  adapters (Meta FB/IG/Threads, X, LinkedIn, TikTok, YouTube, Pinterest, Reddit,
  Google Business) once developer apps exist, signed webhooks, analytics snapshots,
  public preview links, calendar drag-and-drop, RSS-to-ideas, ideas board,
  templates, labels, evergreen recycling, UTM builder, comment inbox.
- Module 2 Website Studio (Astro, awwwards principles, built-in SEO/AEO/GEO).
- Module 3 monthly SEO/GEO/AEO service (geo-seo-claude scripts in the worker).
- Phase 3 Meta ads.

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
