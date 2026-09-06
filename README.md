# Gemrion Social Media Tool

A multi-client social media management platform built with **Next.js 16**, **React 19**, **Supabase**, and **Tailwind 4**. Designed for agencies that manage social media for multiple clients.

## What it does

- **Agency Console** - Plan, schedule, and publish social media posts across Instagram, Facebook, X (Twitter), LinkedIn, and TikTok for multiple clients from one dashboard.
- **Client Portal** - Clients log in with a magic link, see their post calendar, edit copy/captions, approve posts, and leave notes - all scoped to their workspace only.
- **AI Generation** - Built-in AI prompt panel generates Moonli-Navy style image prompts (4:5 ratio) and founder-voice captions via Vercel AI Gateway.
- **OAuth Connect** - Real OAuth 2.0 flows for each platform. When credentials aren't configured, falls back to demo mode for planning.
- **Scheduled Publishing** - Vercel Cron checks every 10 minutes for due posts and publishes them automatically.
- **Safety Gate** - Disabled posts never publish, enforced server-side.

## Architecture

```
src/
  app/
    console/        # Agency dashboard (posts, calendar, clients)
    portal/         # Client-facing portal (view, edit, approve)
    api/
      ai/generate   # AI caption/prompt generation
      oauth/        # OAuth start/callback/disconnect per platform
      publish       # Manual publish endpoint
      cron/publish  # Vercel Cron auto-publisher
    auth/           # Magic link callback + sign out
    login/          # Sign-in page
  components/       # Shared UI components
  lib/
    supabase/       # Server, admin, and browser Supabase clients
    auth.ts         # Role-based auth helpers
    types.ts        # TypeScript types
    platforms.ts    # OAuth platform configs (server-only)
```

## Security Model

Multi-tenant security is enforced at the database level, not in application code:

| Layer | What it controls | Mechanism |
|---|---|---|
| **RLS (Row Level Security)** | Which rows a user can see | `is_agency()` and `can_access_client()` functions |
| **Column GRANTs** | Which fields a client can write | Only `caption`, `copy`, `hashtags`, `approval` |
| **Service-role key** | Agency writes bypass RLS | Server-side only, behind `requireAgency()` |
| **Zero grants on social_accounts** | OAuth tokens are unreachable by clients | No SELECT/UPDATE for authenticated role |

This was verified with 11 automated tests using real JWTs (see `supabase/schema.sql` for the full policy set).

**Key rules:**
- `SUPABASE_SERVICE_ROLE_KEY` is never imported into client components (guarded by `import 'server-only'`)
- Every route using `createAdminClient()` calls `requireAgency()` first
- The service key bypasses RLS, so requireAgency() is the only gate

## Getting Started

### Prerequisites

- Node.js 18+
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
2. Run `supabase/schema.sql` in the SQL Editor to create tables, RLS policies, and grants
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

# AI Generation (optional - needs Vercel billing)
AI_GATEWAY_API_KEY=your-vercel-ai-gateway-key

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

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. First login

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
vercel env add AI_GATEWAY_API_KEY
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
- **AI panel** - generate image prompts and captions with one click

### Client Portal (`/portal`)

- **Post list** filtered to the client's workspace (RLS enforced)
- **Calendar** view of their scheduled content
- **In-place editing** of caption, copy, and hashtags
- **Approve / Request changes** workflow
- **Notes** back to the agency

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
- **AI**: Vercel AI SDK v7 + AI Gateway
- **Hosting**: Vercel
- **Design**: Operations console aesthetic (Geist/Geist Mono, monochrome + orange accent)

## License

Private - All rights reserved.
