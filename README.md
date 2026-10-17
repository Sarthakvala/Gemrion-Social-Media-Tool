# Gemrion Social Media Tool

An internal agency platform for running several client brands end to end, built with **Next.js 16**, **React 19**, **Supabase**, **Claude** and **Tailwind 4**. Train it on a brand once, then plan and produce on-brand social content, carousels, reels and (in later phases) Meta ads and SEO/AEO/GEO work, with client approvals, reporting, and every AI run tracked and costed.

**Phases:** 1 Foundation (jobs, assets, approvals, playbooks) - done. 2 Video & reels, 3 Meta ads, 4 SEO/AEO/GEO, 5 Reporting PDFs, 6 Automation. The console already has a section for each; planned ones say what they need to switch on.

## What it does

- **Settings** - Paste an Anthropic or OpenAI API key, pick the provider and model, test the connection. Keys are AES-256-GCM encrypted in a table no browser session can read.
- **AI brand kit drafting** - Give a website and/or notes; the app reads the site (public addresses only) and drafts voice (4 dimensions + archetype + we-are/we-are-not), audience, pillars, rules, hashtags, palette and fonts for review.
- **Brand kits** - Per brand: voice, audience, pillars and mix, always/never rules, banned words, CTA style, hashtags, palette, fonts, logo, plus approved example posts. Every generation follows the kit.
- **Studio** - Plan a month, or generate a campaign from a brief over any date range. The AI (Claude or GPT) plans the posts, then writes each one: hook, per-platform captions, hashtags, visual brief and slide copy. Posts land as drafts; rewrite any single post with a note.
- **Rendered slides** - Slides are drawn on demand from the brand kit (1080px, 4:5 / 1:1 / 9:16) via `/api/render`. Nothing is stored, so Supabase storage stays tiny.
- **Downloads** - One ZIP per post (slide PNGs + captions.txt per platform) or per month (+ calendar.csv) for staff to post by hand.
- **Playbooks** - Your Claude Code skills ported into versioned prompts that run on a brand kit: reel hooks (viral-hook-writer), carousel builder, caption + hashtags. Results are copy-ready and kept per run.
- **Jobs & spend** - Every AI run and worker task is a job with tokens and cost; this month's spend per brand; retry/cancel; worker test.
- **Assets** - Private, versioned file library per brand (images, slides, videos, reels, documents) with direct-to-storage uploads up to 500 MB, approval and notes. Clients review them under **Files** in the portal.
- **Reports** - This month per brand: posts, published, approvals, files, AI spend.
- **Local worker** - A Node 24 Docker service on the agency machine that pulls long jobs (video renders in phase 2) from Supabase; nothing needs to reach the machine from outside. See `worker/README.md`.
- **Agency Console** - Plan, schedule, and publish social media posts across Instagram, Facebook, X (Twitter), LinkedIn, and TikTok for multiple clients from one dashboard.
- **Client Portal** - Clients log in with a magic link, see their post calendar, edit copy/captions, approve posts, and leave notes - all scoped to their workspace only.
- **OAuth Connect** - Real OAuth 2.0 flows for each platform. When credentials aren't configured, falls back to demo mode for planning.
- **Scheduled Publishing** - Vercel Cron checks every 10 minutes for due posts and publishes them automatically.
- **Safety Gate** - Disabled posts never publish, enforced server-side.

## Architecture

```
src/
  app/
    console/        # Agency app (grouped sidebar): studio, playbooks, video, posts, calendar,
                    #   ads, seo, assets, brands (+ brand kit), reports, jobs, settings
    portal/         # Client-facing portal (view, edit, approve)
    api/
      render        # Slide PNG renderer (brand kit + post)
      oauth/        # OAuth start/callback/disconnect per platform
      publish       # Manual publish endpoint
      cron/publish  # Vercel Cron auto-publisher
    auth/           # Magic link callback + sign out
    login/          # Sign-in page
  components/       # Shared UI components (studio/ = generator, editors, downloads)
  lib/
    supabase/       # Server, admin, and browser Supabase clients
    auth.ts         # Role-based auth helpers
    types.ts        # TypeScript types
    platforms.ts    # OAuth platform configs (server-only)
    studio/         # Prompts, schemas, normalisation, slide renderer, ZIP export
    ai/             # Key encryption, settings, Anthropic/OpenAI providers
    brand/          # Website reader (SSRF-guarded) + AI brand-kit drafting
    jobs/           # Job repository, trackJob() metering, state rules
    assets/         # Storage paths, signed URLs, version history
    playbooks/      # Ported skills: field spec, prompt, schema, normalize, toText
    reports/        # Monthly per-brand aggregation
worker/             # Local Docker pull worker (claim_job, heartbeat, retries)
scripts/            # code-index.mjs -> docs/CODE_INDEX.md
```

## Security Model

Multi-tenant security is enforced at the database level, not in application code:

| Layer | What it controls | Mechanism |
|---|---|---|
| **RLS (Row Level Security)** | Which rows a user can see | `is_agency()` and `can_access_client()` functions |
| **Column GRANTs** | Which fields a client can write | Only `caption`, `copy`, `hashtags`, `approval`, `platform_captions` |
| **Service-role key** | Agency writes bypass RLS | Server-side only, behind `requireAgency()` |
| **Zero grants on social_accounts** | OAuth tokens are unreachable by clients | No SELECT/UPDATE for authenticated role |
| **Zero grants on ai_settings** | AI keys are unreachable from any browser session | Keys also AES-256-GCM encrypted at rest |
| **Zero grants on jobs** | Job inputs, outputs and costs are agency-only | `claim_job()` / `spend_by_brand()` executable by service_role only |
| **Assets: column grant + trigger** | Clients may change only an asset's approval | Approver stamped by trigger; superseded versions locked |
| **Private `assets` bucket** | No direct file access | 1-hour signed URLs, only for rows the caller may already see |

This was verified with 11 automated tests using real JWTs (see `supabase/schema.sql` for the full policy set).

**Key rules:**
- `SUPABASE_SERVICE_ROLE_KEY` is never imported into client components (guarded by `import 'server-only'`)
- Every route using `createAdminClient()` calls `requireAgency()` first
- The service key bypasses RLS, so requireAgency() is the only gate

## Getting Started

### Prerequisites

- Node.js 24+ (the worker runs TypeScript directly; the web app needs 20+)
- Docker Desktop (only for the local worker)
- A Supabase project
- (Optional) Platform OAuth apps for real publishing

### 1. Clone and install

```bash
git clone https://github.com/Sarthakvala/Gemrion-Social-Media-Tool.git
cd Gemrion-Social-Media-Tool
npm install
```

### 2. Set up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql`, then the numbered migrations in order (`002_brand_studio.sql` ... `007_jobs_assets_hardening.sql`) in the SQL Editor
3. (Optional) Run `supabase/migrate_legacy.sql` if migrating from the legacy app

### 3. Configure environment

Create a `.env.local` file:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Site URL (required for OAuth callbacks)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# AI keys: normally entered in the app under Settings (stored encrypted).
# These env vars are optional fallbacks.
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Vercel Cron (required for scheduled publishing)
CRON_SECRET=your-random-secret

# Platform OAuth (optional - demo mode without these)
META_APP_ID=
META_APP_SECRET=
X_CLIENT_ID=
X_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

### 4. Add an AI key

Sign in as agency, open **Settings**, paste an Anthropic and/or OpenAI API key and press **Test connection**.

### 5. Run locally

```bash
npm run dev
npm test              # unit tests (vitest, app + worker)
npm run index:code    # regenerate docs/CODE_INDEX.md
```

### 6. Local worker (optional until phase 2)

Copy `worker/env.template` to `worker/.env`, then:

```bash
docker compose -f worker/docker-compose.yml up -d --build
```

In the console, open **Jobs & spend** and press **Test the worker**.

Open [http://localhost:3000](http://localhost:3000).

### 7. First login

1. Sign in with your email (magic link via Supabase)
2. Promote yourself to agency role in the SQL Editor:
   ```sql
   UPDATE profiles SET role = 'agency' WHERE email = 'your@email.com';
   ```
3. You'll land on the agency console

## Deploying to Vercel

### Quick deploy

```bash
npm i -g vercel
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_SITE_URL
vercel env add CRON_SECRET
vercel deploy --prod
```

### Vercel Cron

The `vercel.json` configures a cron job at `/api/cron/publish` that runs every 10 minutes to publish scheduled posts. The endpoint is protected by `CRON_SECRET`.

### OAuth Redirect URIs

For each platform, set the redirect URI to:
```
https://your-domain.vercel.app/api/oauth/{PLATFORM}/callback
```

Where `{PLATFORM}` is `FB`, `IG`, `X`, `LI`, or `TT`.

## Platform OAuth Setup

| Platform | Developer Portal | Redirect URI Path |
|---|---|---|
| Facebook/Instagram | [developers.facebook.com](https://developers.facebook.com) | `/api/oauth/FB/callback` and `/api/oauth/IG/callback` |
| X (Twitter) | [developer.x.com](https://developer.x.com) | `/api/oauth/X/callback` |
| LinkedIn | [developer.linkedin.com](https://developer.linkedin.com) | `/api/oauth/LI/callback` |
| TikTok | [developers.tiktok.com](https://developers.tiktok.com) | `/api/oauth/TT/callback` |

Without platform credentials, the connect buttons create **demo connections** that simulate publishing - useful for planning content before going live.

## Features

### Agency Console (`/console`)

- **Post list** with client filter chips, status pills, approval badges
- **Month calendar** view showing all scheduled posts
- **Client management** - create clients, invite portal users, connect social accounts
- **Post editor** - full form with date/time, platform selection, copy, creative URL, safety gate
- **Publish button** - publish immediately or let the cron handle it
- **Studio, Playbooks, Assets, Jobs, Reports** - see "What it does" above

### Client Portal (`/portal`)

- **Post list** filtered to the client's workspace (RLS enforced)
- **Calendar** view of their scheduled content
- **In-place editing** of caption, copy, and hashtags
- **Approve / Request changes** workflow
- **Notes** back to the agency
- **Files** - review creatives and videos, approve or ask for changes

### Publishing

- **Facebook** - Graph API v21.0 page feed posts
- **Instagram** - 2-step media container + publish (requires public image URL)
- **X (Twitter)** - API v2 tweet creation (280 char limit)
- **LinkedIn** - UGC Posts API
- **TikTok** - Placeholder (requires video upload via Content Posting API)

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Database**: Supabase (PostgreSQL + Row Level Security)
- **Auth**: Supabase Auth (magic links)
- **AI**: Official Anthropic and OpenAI SDKs (structured outputs), keys entered in Settings
- **Worker**: Node 24 in Docker, polling Supabase (`claim_job`, SKIP LOCKED)
- **Hosting**: Vercel
- **Design**: Operations console aesthetic (Geist/Geist Mono, monochrome + orange accent)

## License

Private - All rights reserved.
