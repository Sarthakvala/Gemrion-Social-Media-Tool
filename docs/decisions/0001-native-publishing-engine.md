---
status: accepted
date: 2026-11-13
---

# Native publishing engine with per-network adapters

## Context and problem statement

AgencyFlow must schedule and publish to every major network with the feature set
of Postiz, Mixpost and TryPost, for 1-5 brands, driven by staff and AI agents.
The owner chose not to use a hosted publishing API (Postiz Cloud and similar) and
will register developer apps per network later. The existing publishing code
supports 5 networks, one account per network per brand, stores tokens
unencrypted, and runs from a Vercel cron that fires once a day.

## Considered options

1. Self-host Postiz or TryPost next to AgencyFlow.
2. Copy provider code from Postiz/TryPost into AgencyFlow.
3. Build our own engine: provider adapters written from each network's official
   API docs, behind one interface.

## Decision outcome

Option 3.

- Option 1 needs ~9 extra services (Postiz) or a PHP stack (TryPost), still needs
  our own developer apps, and splits data across two systems.
- Option 2 is ruled out by licence: Postiz and TryPost are AGPL-3.0. AgencyFlow is
  used by clients over the network, so copied code would oblige us to publish
  AgencyFlow's source to them. Features are reimplemented from official API docs;
  Mixpost Lite (MIT) may be reused with attribution.

### Shape

- **Adapter pattern:** one `Provider` interface (`validate`, `publish`, optional
  `refresh`, connect flow) per network, registered in a network registry that
  declares auth type, whether a developer app is required, text/media limits and
  supported formats.
- **Channels, not "one account per network":** a brand can connect any number of
  channels per network. Credentials are AES-256-GCM encrypted with the same helper
  as AI keys.
- **Per-channel targets:** a post fans out to `post_targets` (one per channel) with
  its own text override, settings, status, external id/url and retries.
- **Networks that need no developer app ship first:** Bluesky (app password),
  Mastodon (per-instance app registered automatically), Telegram (bot token),
  Discord (channel webhook). OAuth networks (Meta FB/IG/Threads, X, LinkedIn,
  TikTok, YouTube, Pinterest, Reddit, Google Business) are implemented against
  their official APIs and switch on when their client id/secret env vars exist.
- **Scheduling:** Supabase `pg_cron` + `pg_net` call `/api/cron/publish` every
  minute (Vercel Hobby crons run daily only). Due targets are claimed with
  `FOR UPDATE SKIP LOCKED`; large video uploads are handed to the local worker.
- **Approval gate:** only client-approved posts are published, for staff, API and
  agents alike.

### Consequences

- Good: one data model, no licence risk, works today on four networks without any
  developer app, the rest light up per network as apps are approved.
- Bad: we own ongoing maintenance of each network integration (API version bumps).
- Bad: `pg_cron` setup is a production database change the owner must apply.
